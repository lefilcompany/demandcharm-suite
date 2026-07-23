import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  usePendingDemandRequests, 
  useApprovedDemandRequests,
  useReturnedDemandRequests,
  useApproveDemandRequest, 
  useReturnDemandRequest,
  useMyDemandRequests,
  useUpdateDemandRequest,
  useDeleteDemandRequest
} from "@/hooks/useDemandRequests";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Clock, CheckCircle, RotateCcw, Users, Layout, Paperclip, MessageSquare, Send, Trash2, XCircle, ChevronLeft, ChevronRight, ClipboardList, Edit, Plus, CalendarIcon, X, Search, Filter, ChevronDown, Layers } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditor, RichTextDisplay } from "@/components/ui/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssigneeSelector } from "@/components/AssigneeSelector";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { calculateBusinessDueDate, formatDueDateForInput } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errorUtils";
import { RequestAttachmentBadge } from "@/components/RequestAttachmentBadge";
import { RequestAttachmentUploader } from "@/components/RequestAttachmentUploader";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useRequestComments, useCreateRequestComment, useDeleteRequestComment } from "@/hooks/useRequestComments";
import { MentionInput } from "@/components/MentionInput";
import { MentionText } from "@/components/MentionText";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { extractMentionedUserIds } from "@/lib/mentionUtils";
import { sendMentionPushNotification } from "@/hooks/useSendPushNotification";
import { supabase } from "@/integrations/supabase/client";
import { useUploadRequestAttachment } from "@/hooks/useRequestAttachments";
import { CommentAttachmentUploader } from "@/components/CommentAttachmentUploader";
import { CommentAttachments } from "@/components/CommentAttachments";
import { ServiceSelector } from "@/components/ServiceSelector";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useBoardServices } from "@/hooks/useBoardServices";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useTeamMembershipRole } from "@/hooks/useTeamRole";
import { cn } from "@/lib/utils";
import { SEOHead } from "@/components/SEOHead";
import { safeDateTimestamp } from "@/lib/demandViewSafety";

const priorityColors: Record<string, string> = {
  baixa: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  média: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  alta: "bg-destructive/20 text-destructive border-destructive/30"
};

interface SubdemandPlanItem {
  title?: string;
  description?: string;
  priority?: string;
  service_id?: string;
}

function SubdemandsPlanSection({ requestId, boardId, plan }: { requestId: string; boardId: string; plan: SubdemandPlanItem[] }) {
  const { data: boardServices } = useBoardServices(boardId);
  const serviceMap = useMemo(() => {
    const map = new Map<string, { name: string; estimated_hours: number | null }>();
    (boardServices || []).forEach((bs: any) => {
      if (bs?.service?.id) map.set(bs.service.id, { name: bs.service.name, estimated_hours: bs.service.estimated_hours });
    });
    return map;
  }, [boardServices]);

  return (
    <div className="space-y-2 pt-4 border-t">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Layers className="h-4 w-4" />
        Subdemandas ({plan.length})
      </Label>
      <Accordion type="multiple" className="border rounded-lg divide-y">
        {plan.map((sub, i) => {
          const svc = sub.service_id ? serviceMap.get(sub.service_id) : null;
          return (
            <AccordionItem key={i} value={`sub-${i}`} className="border-0 px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex flex-1 items-center gap-2 text-left flex-wrap pr-2">
                  <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                  <span className="text-sm font-medium">{sub.title || "(sem título)"}</span>
                  {sub.priority && (
                    <Badge variant="outline" className={`${priorityColors[sub.priority] || ""} text-[10px]`}>
                      {sub.priority}
                    </Badge>
                  )}
                  {svc && (
                    <Badge variant="outline" className="text-[10px]">
                      {svc.name}{svc.estimated_hours != null ? ` (${svc.estimated_hours}h)` : ""}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3 space-y-3">
                {sub.description && (
                  <div className="p-3 rounded-md bg-muted text-sm">
                    <RichTextDisplay content={sub.description} />
                  </div>
                )}
                <div className="border rounded-lg p-3">
                  <RequestAttachmentUploader requestId={requestId} readOnly subdemandIndex={i} />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}


export default function DemandRequests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { selectedTeamId } = useSelectedTeam();
  const { selectedBoardId, currentBoard } = useSelectedBoard();
  const { data: boardRole } = useBoardRole(selectedBoardId);
  const { data: teamMembershipRole } = useTeamMembershipRole(selectedTeamId);
  
  const isRequester = boardRole === "requester" || (!boardRole && teamMembershipRole === "requester");
  const canApproveOrReturn = boardRole === "admin" || boardRole === "moderator";
  
  // Fetch all types of requests
  const { data: pendingRequests, isLoading: pendingLoading } = usePendingDemandRequests();
  const { data: approvedRequests, isLoading: approvedLoading } = useApprovedDemandRequests();
  const { data: returnedRequests, isLoading: returnedLoading } = useReturnedDemandRequests();
  
  // My requests (for requester tab)
  const { data: myRequests, isLoading: myLoading } = useMyDemandRequests();
  
  const approveRequest = useApproveDemandRequest();
  const returnRequest = useReturnDemandRequest();
  const updateRequest = useUpdateDemandRequest();
  const deleteRequest = useDeleteDemandRequest();
  
  // Determine default tab based on role
  const defaultTab = isRequester ? "mine" : "pending";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [viewing, setViewing] = useState<any | null>(null);
  const [approving, setApproving] = useState<any | null>(null);
  const [returning, setReturning] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [commentText, setCommentText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Edit dialog state (for requester editing own requests)
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("média");
  const [editServiceId, setEditServiceId] = useState("");

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const matchesSearch = useCallback((request: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (request.title || "").toLowerCase();
    const priority = (request.priority || "").toLowerCase();
    const serviceName = (request.service?.name || "").toLowerCase();
    return title.includes(q) || priority.includes(q) || serviceName.includes(q);
  }, [searchQuery]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // My requests filters
  const [myStatusFilter, setMyStatusFilter] = useState<string>("all");
  const [mySelectedDate, setMySelectedDate] = useState<Date | undefined>();

  // Unified admin filters (single view, no tabs)
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>("pending");
  const [adminPriorityFilter, setAdminPriorityFilter] = useState<string>("all");
  const [adminDateFilter, setAdminDateFilter] = useState<Date | undefined>();
  const [adminFiltersOpen, setAdminFiltersOpen] = useState(false);
  const [adminSearchOpen, setAdminSearchOpen] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const adminSearchRef = useRef<HTMLInputElement>(null);

  // Pagination states
  const [approvedPage, setApprovedPage] = useState(1);
  const [returnedPage, setReturnedPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const rowsPerPageOptions = [10, 25, 50, 100];

  // Update default tab when role changes
  useEffect(() => {
    if (isRequester && activeTab === "pending" && !canApproveOrReturn) {
      setActiveTab("mine");
    }
  }, [isRequester, canApproveOrReturn]);

  // Handle highlight param - auto-open a specific request
  const highlightId = searchParams.get("highlight");
  useEffect(() => {
    if (!highlightId) return;
    
    // Search in all request lists
    const allRequests = [
      ...(pendingRequests || []),
      ...(approvedRequests || []),
      ...(returnedRequests || []),
      ...(myRequests || []),
    ];
    
    const found = allRequests.find((r: any) => r.id === highlightId);
    if (found) {
      setViewing(found);
      // Clear the highlight param
      searchParams.delete("highlight");
      setSearchParams(searchParams, { replace: true });
    }
  }, [highlightId, pendingRequests, approvedRequests, returnedRequests, myRequests]);

  // All board requests combined (for requester "Todas do Quadro" tab)
  const allBoardRequests = useMemo(() => {
    return [
      ...(pendingRequests || []),
      ...(approvedRequests || []),
      ...(returnedRequests || []),
    ].filter(matchesSearch);
  }, [pendingRequests, approvedRequests, returnedRequests, matchesSearch]);

  const [allBoardPage, setAllBoardPage] = useState(1);

  const paginatedAllBoard = useMemo(() => {
    const totalPages = Math.ceil(allBoardRequests.length / itemsPerPage);
    const startIndex = (allBoardPage - 1) * itemsPerPage;
    const items = allBoardRequests.slice(startIndex, startIndex + itemsPerPage);
    return { items, totalPages, totalItems: allBoardRequests.length };
  }, [allBoardRequests, allBoardPage, itemsPerPage]);

  const matchesTabSearch = useCallback((request: any, query: string) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const title = (request.title || "").toLowerCase();
    const priority = (request.priority || "").toLowerCase();
    const serviceName = (request.service?.name || "").toLowerCase();
    const creatorName = (request.creator?.full_name || "").toLowerCase();
    return title.includes(q) || priority.includes(q) || serviceName.includes(q) || creatorName.includes(q);
  }, []);

  const applyDateFilter = useCallback((request: any, dateFilter: Date | undefined, dateField: string = "created_at") => {
    if (!dateFilter) return true;
    const d = new Date(request[dateField]);
    return !isBefore(d, startOfDay(dateFilter)) && !isAfter(d, endOfDay(dateFilter));
  }, []);

  // Unified admin: combine all requests, filter, sort newest first
  const allAdminRequests = useMemo(() => {
    const all = [
      ...(pendingRequests || []),
      ...(approvedRequests || []),
      ...(returnedRequests || []),
    ];
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all;
  }, [pendingRequests, approvedRequests, returnedRequests]);

  const adminStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allAdminRequests.length };
    allAdminRequests.forEach((r: any) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [allAdminRequests]);

  const filteredAdminRequests = useMemo(() => {
    return allAdminRequests.filter(r => {
      if (!matchesTabSearch(r, adminSearchQuery)) return false;
      if (adminStatusFilter !== "all" && r.status !== adminStatusFilter) return false;
      if (adminPriorityFilter !== "all" && (r.priority || "média") !== adminPriorityFilter) return false;
      if (!applyDateFilter(r, adminDateFilter)) return false;
      return true;
    });
  }, [allAdminRequests, adminSearchQuery, adminStatusFilter, adminPriorityFilter, adminDateFilter, matchesTabSearch, applyDateFilter]);

  const [adminPage, setAdminPage] = useState(1);

  const paginatedAdmin = useMemo(() => {
    const totalPages = Math.ceil(filteredAdminRequests.length / itemsPerPage);
    const startIndex = (adminPage - 1) * itemsPerPage;
    const items = filteredAdminRequests.slice(startIndex, startIndex + itemsPerPage);
    return { items, totalPages, totalItems: filteredAdminRequests.length };
  }, [filteredAdminRequests, adminPage, itemsPerPage]);

  // My requests filtered
  const myStatusCounts = useMemo(() => {
    if (!myRequests) return {};
    const counts: Record<string, number> = { all: myRequests.length };
    myRequests.forEach((r: any) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [myRequests]);

  const filteredMyRequests = useMemo(() => {
    if (!myRequests) return [];
    return myRequests.filter((request: any) => {
      if (!matchesSearch(request)) return false;
      if (myStatusFilter !== "all" && request.status !== myStatusFilter) return false;
      if (mySelectedDate) {
        const requestDate = new Date(request.created_at);
        const start = startOfDay(mySelectedDate);
        const end = endOfDay(mySelectedDate);
        if (isBefore(requestDate, start) || isAfter(requestDate, end)) return false;
      }
      return true;
    });
  }, [myRequests, myStatusFilter, mySelectedDate, matchesSearch]);

  const [myPage, setMyPage] = useState(1);
  const paginatedMy = useMemo(() => {
    const totalPages = Math.ceil(filteredMyRequests.length / itemsPerPage);
    const startIndex = (myPage - 1) * itemsPerPage;
    const items = filteredMyRequests.slice(startIndex, startIndex + itemsPerPage);
    return { items, totalPages, totalItems: filteredMyRequests.length };
  }, [filteredMyRequests, myPage, itemsPerPage]);

  // Comments hooks
  const { data: comments, isLoading: commentsLoading } = useRequestComments(viewing?.id || null);
  const createComment = useCreateRequestComment();
  const deleteComment = useDeleteRequestComment();
  const uploadAttachment = useUploadRequestAttachment();

  const openApproveDialog = (request: any) => {
    setApproving(request);
    setAssigneeIds([]);
    if (request.service?.estimated_hours) {
      const calculatedDate = calculateBusinessDueDate(request.service.estimated_hours);
      setDueDate(formatDueDateForInput(calculatedDate));
    } else {
      setDueDate("");
    }
  };

  const handleApprove = async () => {
    if (!approving) return;
    approveRequest.mutate({
      requestId: approving.id,
      assigneeIds,
      dueDate: dueDate || undefined
    }, {
      onSuccess: () => {
        toast.success("Demanda criada com sucesso!");
        setApproving(null);
        navigate("/demands");
      },
      onError: (error: any) => {
        toast.error("Erro ao aprovar", {
          description: getErrorMessage(error)
        });
      }
    });
  };

  const handleReturn = async () => {
    if (!returning || !returnReason.trim()) return;
    returnRequest.mutate({
      requestId: returning.id,
      reason: returnReason.trim()
    }, {
      onSuccess: () => {
        toast.success("Solicitação devolvida ao solicitante");
        setReturning(null);
        setReturnReason("");
      },
      onError: (error: any) => {
        toast.error("Erro ao devolver", {
          description: getErrorMessage(error)
        });
      }
    });
  };

  const handleAddComment = async () => {
    if (!viewing || !commentText.trim()) return;
    try {
      let content = commentText.trim();
      if (content.includes('data:image')) {
        try {
          const { uploadInlineImages } = await import("@/lib/imageUploadUtils");
          content = await uploadInlineImages(content);
        } catch (err) {
          console.error("Error uploading inline images:", err);
          content = content.replace(/<img\s+src="data:[^"]*"[^>]*\/?>/g, '[imagem não enviada]');
        }
      }
      
      const comment = await createComment.mutateAsync({
        requestId: viewing.id,
        content,
      });

      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await uploadAttachment.mutateAsync({
            requestId: viewing.id,
            file,
            commentId: comment.id
          });
        }
      }

      setCommentText("");
      setPendingFiles([]);
      toast.success("Comentário adicionado");

      // Fire mention notifications in background
      const mentionedIds = extractMentionedUserIds(content).filter((id) => id !== user?.id);
      if (mentionedIds.length > 0 && user?.id) {
        (async () => {
          try {
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
            const mentionerName = profile?.full_name || "Alguém";
            const mentionNotifs = mentionedIds.map((uid) => ({
              user_id: uid,
              title: "Você foi mencionado",
              message: `${mentionerName} mencionou você em um comentário da solicitação "${viewing.title}"`,
              type: "mention",
              link: `/demand-requests?view=${viewing.id}`,
            }));
            await supabase.from("notifications").insert(mentionNotifs);
            for (const uid of mentionedIds) {
              sendMentionPushNotification({
                mentionedUserId: uid,
                demandId: viewing.id,
                demandTitle: viewing.title,
                mentionerName,
              }).catch(console.error);
            }
          } catch (err) {
            console.error("Error sending mention notifications:", err);
          }
        })();
      }
    } catch (error: any) {
      toast.error("Erro ao adicionar comentário", {
        description: getErrorMessage(error)
      });
    }
  };

  const handleDeleteComment = (commentId: string) => {
    if (!viewing) return;
    deleteComment.mutate({
      commentId,
      requestId: viewing.id
    }, {
      onSuccess: () => {
        toast.success("Comentário removido");
      },
      onError: (error: any) => {
        toast.error("Erro ao remover comentário", {
          description: getErrorMessage(error)
        });
      }
    });
  };

  // Edit handlers for requester
  const openEditDialog = (request: any) => {
    setEditingRequest(request);
    setEditTitle(request.title);
    setEditDescription(request.description || "");
    setEditPriority(request.priority || "média");
    setEditServiceId(request.service_id || "");
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest || !editTitle.trim()) return;
    updateRequest.mutate(
      {
        id: editingRequest.id,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        priority: editPriority,
        service_id: editServiceId && editServiceId !== "none" ? editServiceId : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Solicitação reenviada com sucesso!");
          setEditingRequest(null);
        },
        onError: (error: any) => {
          toast.error("Erro ao reenviar", { description: getErrorMessage(error) });
        },
      }
    );
  };

  const handleDeleteRequest = (id: string) => {
    setDeletingId(id);
  };

  const confirmDeleteRequest = () => {
    if (!deletingId) return;
    const id = deletingId;
    deleteRequest.mutate(id, {
      onSuccess: () => toast.success("Solicitação excluída"),
      onError: (error: any) => toast.error("Erro ao excluir", { description: getErrorMessage(error) }),
    });
    setDeletingId(null);
  };


  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatDateOrFallback = (value: unknown, pattern: string) => {
    const timestamp = safeDateTimestamp(value);
    if (timestamp === null) return "--";
    return format(new Date(timestamp), pattern, { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-700 border border-green-500/30">
            <SEOHead title="Solicitações de Demanda" path="/demand-requests" />
            <CheckCircle className="h-3 w-3 mr-1" />
            Aprovada
          </Badge>
        );
      case "returned":
        return (
          <Badge className="bg-orange-500/20 text-orange-700 border border-orange-500/30">
            <SEOHead title="Solicitações de Demanda" path="/demand-requests" />
            <XCircle className="h-3 w-3 mr-1" />
            Devolvida
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/20 text-destructive border border-destructive/30">
            <SEOHead title="Solicitações de Demanda" path="/demand-requests" />
            <XCircle className="h-3 w-3 mr-1" />
            Rejeitada
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/20 text-yellow-700 border border-yellow-500/30">
            <SEOHead title="Solicitações de Demanda" path="/demand-requests" />
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getSubdemandCount = (request: any): number => {
    const plan = request?.subdemands_plan;
    return Array.isArray(plan) ? plan.length : 0;
  };

  const withSubdemandStack = (request: any, cardNode: React.ReactNode) => {
    const count = getSubdemandCount(request);
    if (count <= 0) return cardNode;
    return (
      <div key={request.id} className="relative" style={{ marginBottom: count > 1 ? 14 : 8 }}>
        {/* iOS-style stacked layers behind the card */}
        <div
          aria-hidden
          className="absolute left-3 right-3 -bottom-1 h-3 rounded-xl border border-border/60 bg-card shadow-sm -z-10"
        />
        {count > 1 && (
          <div
            aria-hidden
            className="absolute left-5 right-5 -bottom-2 h-3 rounded-xl border border-border/50 bg-card/80 shadow-sm -z-20"
          />
        )}
        {cardNode}
      </div>
    );
  };

  const renderRequestCard = (request: any, showReapproveButton = false) => withSubdemandStack(request,
    <Card key={request.id} className="cursor-pointer hover:shadow-md transition-shadow relative" onClick={() => setViewing(request)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <Layout className="h-3 w-3 mr-1" />
                {request.board?.name || "Quadro"}
              </Badge>
            </div>
            <CardTitle className="text-lg">{request.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={request.creator?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(request.creator?.full_name || "?")}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/user/${request.created_by}`);
                }}
                className="hover:text-primary hover:underline cursor-pointer transition-colors"
              >
                {request.creator?.full_name}
              </button>
              {" "}•{" "}
              {formatDateOrFallback(request.created_at, "dd/MM 'às' HH:mm")}
            </CardDescription>
          </div>
          {getStatusBadge(request.status)}
        </div>
      </CardHeader>
      <CardContent>
        {request.description && (
          <RichTextDisplay content={request.description} className="text-sm text-muted-foreground mb-3 line-clamp-2" />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`${priorityColors[request.priority || "média"]} border`}>
            Prioridade: {request.priority || "média"}
          </Badge>
          {request.service && (
            <Badge variant="outline">
              {request.service.name} ({request.service.estimated_hours}h)
            </Badge>
          )}
          <RequestAttachmentBadge requestId={request.id} />
          {getSubdemandCount(request) > 0 && (
            <Badge variant="outline" className="bg-primary/5 border-primary/30 text-primary">
              <Layers className="h-3 w-3 mr-1" />
              {getSubdemandCount(request)} {getSubdemandCount(request) === 1 ? "subdemanda" : "subdemandas"}
            </Badge>
          )}
        </div>

        {request.status === "returned" && request.rejection_reason && (
          <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">Motivo da devolução:</p>
            <div className="text-sm text-muted-foreground">
              <RichTextDisplay content={request.rejection_reason} />
            </div>
          </div>
        )}

        {(request.status === "approved" || request.status === "returned") && request.responder && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
            <span>{request.status === "approved" ? "Aprovada" : "Devolvida"} por {request.responder.full_name}</span>
            {request.responded_at && (
              <span>em {format(new Date(request.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            )}
          </div>
        )}

        {showReapproveButton && canApproveOrReturn && (
          <div className="flex gap-2 mt-4 pt-3 border-t">
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                openApproveDialog(request);
              }}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Reaprovar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );






  // Render a "my request" card (requester view with edit/delete)
  const renderMyRequestCard = (request: any) => {
    const statusMap: Record<string, { label: string; icon: any; color: string }> = {
      pending: { label: "Pendente", icon: Clock, color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
      approved: { label: "Aprovada", icon: CheckCircle, color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" },
      rejected: { label: "Rejeitada", icon: XCircle, color: "bg-destructive/20 text-destructive border-destructive/30" },
      returned: { label: "Devolvida", icon: RotateCcw, color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
    };
    const status = statusMap[request.status] || statusMap.pending;
    const StatusIcon = status.icon;
    const canEdit = request.status === "returned" || request.status === "pending";

    return withSubdemandStack(request,
      <Card key={request.id} className="cursor-pointer hover:shadow-md transition-shadow relative" onClick={() => setViewing(request)}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <Layout className="h-3 w-3 mr-1" />
                  {request.board?.name || "Quadro"}
                </Badge>
              </div>
              <CardTitle className="text-lg">{request.title}</CardTitle>
              <CardDescription>
                Criada em {formatDateOrFallback(request.created_at, "dd 'de' MMMM 'às' HH:mm")}
              </CardDescription>
            </div>
            <Badge className={`${status.color} border`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {request.description && (
            <RichTextDisplay content={request.description} className="text-sm text-muted-foreground mb-3 line-clamp-2" />
          )}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="outline">Prioridade: {request.priority || "média"}</Badge>
            {request.service && (
              <Badge variant="outline">Serviço: {request.service.name}</Badge>
            )}
            <RequestAttachmentBadge requestId={request.id} />
            {getSubdemandCount(request) > 0 && (
              <Badge variant="outline" className="bg-primary/5 border-primary/30 text-primary">
                <Layers className="h-3 w-3 mr-1" />
                {getSubdemandCount(request)} {getSubdemandCount(request) === 1 ? "subdemanda" : "subdemandas"}
              </Badge>
            )}
          </div>

          {request.rejection_reason && (
            <div className="p-3 rounded-md bg-muted mb-3">
              <p className="text-sm font-medium mb-1">
                {request.status === "returned" ? "Motivo da devolução:" : "Motivo da rejeição:"}
              </p>
              <RichTextDisplay content={request.rejection_reason || ""} className="text-sm text-muted-foreground" />
              {request.responder && (
                <p className="text-xs text-muted-foreground mt-2">
                  Por{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/user/${request.responded_by}`);
                    }}
                    className="font-medium hover:text-primary hover:underline cursor-pointer transition-colors"
                  >
                    {request.responder.full_name}
                  </button>
                  {" "}em{" "}
                  {request.responded_at && formatDateOrFallback(request.responded_at, "dd/MM/yyyy 'às' HH:mm")}
                </p>
              )}
            </div>
          )}

          {canEdit && (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm" onClick={() => openEditDialog(request)}>
                <Edit className="h-4 w-4 mr-1" />
                {request.status === "returned" ? "Editar e Reenviar" : "Editar"}
              </Button>
              {request.status === "pending" && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteRequest(request.id)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = (message: string) => (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <p>{message}</p>
      </CardContent>
    </Card>
  );

  const handleItemsPerPageChange = (value: string) => {
    const newVal = parseInt(value);
    setItemsPerPage(newVal);
    setAllBoardPage(1);
    setAdminPage(1);
    setApprovedPage(1);
    setReturnedPage(1);
    setMyPage(1);
  };

  const renderPaginationBar = (page: number, setPage: (fn: (p: number) => number) => void, totalPages: number, totalItems: number) => {
    return (
      <div className="flex items-center justify-between border-t border-border pt-3 mt-4">
        <SEOHead title="Solicitações de Demanda" path="/demand-requests" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Itens por página</span>
          <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rowsPerPageOptions.map(opt => (
                <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>{totalItems} registro{totalItems !== 1 ? "s" : ""} encontrado{totalItems !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Página {page} de {totalPages || 1}</span>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Keep old renderPagination for inline usage in admin toolbar
  const renderPagination = (page: number, setPage: (fn: (p: number) => number) => void, totalPages: number) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SEOHead title="Solicitações de Demanda" path="/demand-requests" />
        <span>Página {page} de {totalPages}</span>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const priorityOptions = [
    { value: "all", label: "Todas" },
    { value: "baixa", label: "Baixa" },
    { value: "média", label: "Média" },
    { value: "alta", label: "Alta" },
  ];

  const adminStatusOptions = [
    { value: "pending", label: "Pendentes", icon: Clock },
    { value: "approved", label: "Aprovadas", icon: CheckCircle },
    { value: "returned", label: "Devolvidas", icon: RotateCcw },
    { value: "all", label: "Todas", icon: null },
  ];

  const renderUnifiedAdminToolbar = () => {
    return (
      <div className="space-y-3">
        <SEOHead title="Solicitações de Demanda" path="/demand-requests" />
        {/* Horizontal filter row with search */}
        <div className="flex items-center gap-2">
          {/* Search button */}
          <div className={cn(
            "group flex items-center transition-all duration-300 ease-in-out rounded-xl border overflow-hidden shrink-0",
            adminSearchOpen
              ? "w-72 sm:w-80 border-primary/40 bg-background shadow-sm ring-1 ring-primary/10"
              : "w-9 border-border bg-muted/40 hover:bg-background hover:border-[#F28705]/40 hover:shadow-sm"
          )}>
            <button
              className={cn(
                "h-9 w-9 shrink-0 flex items-center justify-center transition-colors rounded-l-xl",
                adminSearchOpen ? "text-primary" : "text-muted-foreground group-hover:text-[#F28705]"
              )}
              onClick={() => {
                if (adminSearchOpen && adminSearchQuery) { setAdminSearchQuery(""); }
                else { setAdminSearchOpen(!adminSearchOpen); if (adminSearchOpen) setAdminSearchQuery(""); }
              }}
            >
              {adminSearchOpen && adminSearchQuery ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            {adminSearchOpen && (
              <input
                ref={adminSearchRef}
                type="text"
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                placeholder="Buscar por título, solicitante, prioridade..."
                className="h-9 w-full bg-transparent text-sm outline-none pr-3 text-foreground placeholder:text-muted-foreground/60"
                onKeyDown={(e) => { if (e.key === "Escape") { setAdminSearchQuery(""); setAdminSearchOpen(false); } }}
              />
            )}
          </div>

          {/* Scrollable horizontal filters */}
          <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <div className="flex items-center gap-1.5 min-w-max">
              {/* Status filters */}
              {adminStatusOptions.map((opt) => {
                const TabIcon = opt.icon;
                const count = adminStatusCounts[opt.value] || 0;
                const isActive = adminStatusFilter === opt.value;
                return (
                  <button key={opt.value} onClick={() => { setAdminStatusFilter(isActive && opt.value !== "pending" ? "pending" : opt.value); setAdminPage(1); }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap shrink-0",
                      isActive
                        ? "bg-primary/10 border-primary text-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
                    )}
                  >
                    {TabIcon && <TabIcon className="h-3.5 w-3.5" />}
                    {opt.label}
                    <span className={cn(
                      "text-[10px] rounded-full px-1.5 py-0.5 min-w-4 text-center",
                      isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* Separator */}
              <div className="w-px h-5 bg-border shrink-0 mx-1" />

              {/* Priority filters */}
              {priorityOptions.map((opt) => {
                const isActive = adminPriorityFilter === opt.value;
                return (
                  <button key={opt.value} onClick={() => { setAdminPriorityFilter(opt.value); setAdminPage(1); }}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap shrink-0",
                      isActive
                        ? "bg-primary/10 border-primary text-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}

              {/* Separator */}
              <div className="w-px h-5 bg-border shrink-0 mx-1" />

              {/* Date filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap shrink-0",
                      adminDateFilter
                        ? "bg-primary/10 border-primary text-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {adminDateFilter ? format(adminDateFilter, "dd/MM/yyyy", { locale: ptBR }) : "Data"}
                    {adminDateFilter && (
                      <span
                        onClick={(e) => { e.stopPropagation(); setAdminDateFilter(undefined); setAdminPage(1); }}
                        className="ml-0.5 hover:text-destructive cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={adminDateFilter} onSelect={(d) => { setAdminDateFilter(d); setAdminPage(1); }} initialFocus />
                </PopoverContent>
              </Popover>

              {/* Clear all - only show when non-default filters are active */}
              {(adminPriorityFilter !== "all" || adminDateFilter || adminSearchQuery) && (
                <>
                  <div className="w-px h-5 bg-border shrink-0 mx-1" />
                  <button
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-destructive transition-colors whitespace-nowrap shrink-0"
                    onClick={() => { setAdminStatusFilter("pending"); setAdminPriorityFilter("all"); setAdminDateFilter(undefined); setAdminSearchQuery(""); setAdminSearchOpen(false); setAdminPage(1); }}
                  >
                    <X className="h-3 w-3" />
                    Limpar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="shrink-0">
            {paginatedAdmin.totalItems > 0 && <span className="text-xs text-muted-foreground whitespace-nowrap">{paginatedAdmin.totalItems} resultado{paginatedAdmin.totalItems !== 1 ? "s" : ""}</span>}
          </div>
        </div>
      </div>
    );
  };

  const myStatusTabs = [
    { value: "all", label: "Todas", icon: null },
    { value: "pending", label: "Pendentes", icon: Clock },
    { value: "approved", label: "Aprovadas", icon: CheckCircle },
    { value: "returned", label: "Devolvidas", icon: RotateCcw },
    { value: "rejected", label: "Rejeitadas", icon: XCircle },
  ];

  const pageTitle = "Solicitações de Demanda";

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <SEOHead title="Solicitações de Demanda" path="/demand-requests" />
      <PageBreadcrumb
        items={[
          { label: pageTitle, icon: Send, isCurrent: true },
        ]}
      />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{pageTitle}</h1>
        </div>
      </div>

      {isRequester ? (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn(
          "w-full grid mb-4",
          isRequester && canApproveOrReturn ? "grid-cols-3" : "grid-cols-2"
        )}>
          <TabsTrigger value="mine" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Minhas</span>
            {myRequests && myRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">{myRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all-board" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Todas do Quadro</span>
            {allBoardRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">{allBoardRequests.length}</Badge>
            )}
          </TabsTrigger>
          {canApproveOrReturn && (
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Gestão</span>
              {allAdminRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{allAdminRequests.length}</Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>
          <TabsContent value="mine">
            <div className="space-y-4">
              {/* Compact filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className={cn(
                  "group flex items-center transition-all duration-300 ease-in-out rounded-xl border overflow-hidden",
                  searchOpen
                    ? "w-72 sm:w-80 border-primary/40 bg-background shadow-sm ring-1 ring-primary/10"
                    : "w-9 border-border bg-muted/40 hover:bg-background hover:border-[#F28705]/40 hover:shadow-sm"
                )}>
                  <button
                    className={cn(
                      "h-9 w-9 shrink-0 flex items-center justify-center transition-colors rounded-l-xl",
                      searchOpen ? "text-primary" : "text-muted-foreground group-hover:text-[#F28705]"
                    )}
                    onClick={() => {
                      if (searchOpen && searchQuery) {
                        setSearchQuery("");
                      } else {
                        setSearchOpen(!searchOpen);
                        if (searchOpen) setSearchQuery("");
                      }
                    }}
                  >
                    {searchOpen && searchQuery ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  </button>
                  {searchOpen && (
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por título, prioridade ou serviço..."
                      className="h-9 w-full bg-transparent text-sm outline-none pr-3 text-foreground placeholder:text-muted-foreground/60"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setSearchQuery("");
                          setSearchOpen(false);
                        }
                      }}
                    />
                  )}
                </div>

                {/* Filter toggle */}
                <Button
                  variant={filtersOpen ? "secondary" : "outline"}
                  size="sm"
                  className={cn(
                    "gap-2 rounded-lg transition-all",
                    !filtersOpen && "hover:bg-white hover:text-[#F28705] hover:border-[#F28705]",
                    (myStatusFilter !== "all" || mySelectedDate) && "border-primary text-primary bg-primary/5"
                  )}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <Filter className="h-4 w-4" />
                  Filtros
                  {(myStatusFilter !== "all" || mySelectedDate) && (
                    <Badge className="h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground">
                      {(myStatusFilter !== "all" ? 1 : 0) + (mySelectedDate ? 1 : 0)}
                    </Badge>
                  )}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
                </Button>

                {/* Active filter pills */}
                {myStatusFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium">
                    {myStatusTabs.find(t => t.value === myStatusFilter)?.label}
                    <button onClick={() => setMyStatusFilter("all")} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {mySelectedDate && (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium">
                    {format(mySelectedDate, "dd/MM/yyyy", { locale: ptBR })}
                    <button onClick={() => setMySelectedDate(undefined)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}

                {(myStatusFilter !== "all" || mySelectedDate || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={() => { setMyStatusFilter("all"); setMySelectedDate(undefined); setSearchQuery(""); setSearchOpen(false); }}
                  >
                    Limpar tudo
                  </Button>
                )}
              </div>

              {/* Expanded filters panel */}
              {filtersOpen && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4 animate-fade-in">
                  {/* Status buttons */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {myStatusTabs.map((tab) => {
                        const TabIcon = tab.icon;
                        const count = myStatusCounts[tab.value] || 0;
                        const isActive = myStatusFilter === tab.value;
                        return (
                          <button
                            key={tab.value}
                            onClick={() => setMyStatusFilter(tab.value)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                              isActive
                                ? "bg-primary/10 border-primary text-primary shadow-sm"
                                : "bg-background border-border text-muted-foreground hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
                            )}
                          >
                            {TabIcon && <TabIcon className="h-3.5 w-3.5" />}
                            {tab.label}
                            <span className={cn(
                              "text-xs rounded-full px-1.5 py-0.5 min-w-5 text-center",
                              isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date filter */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Data</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "gap-2 rounded-lg hover:bg-white hover:text-[#F28705] hover:border-[#F28705]",
                            mySelectedDate && "border-primary bg-primary/5 text-primary"
                          )}
                        >
                          <CalendarIcon className="h-4 w-4" />
                          {mySelectedDate ? format(mySelectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={mySelectedDate} onSelect={setMySelectedDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {myLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : paginatedMy.items.length > 0 ? (
                <>
                  <div className="grid gap-4">
                    {paginatedMy.items.map((request: any) => renderMyRequestCard(request))}
                  </div>
                  {renderPaginationBar(myPage, setMyPage, paginatedMy.totalPages, paginatedMy.totalItems)}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {(myStatusFilter !== "all" || mySelectedDate || searchQuery) ? (
                      <>
                        <p>Nenhuma solicitação encontrada com os filtros aplicados</p>
                        <Button variant="outline" className="mt-4" onClick={() => { setMyStatusFilter("all"); setMySelectedDate(undefined); setSearchQuery(""); }}>
                          Limpar Filtros
                        </Button>
                      </>
                    ) : (
                      <>
                        <p>Você ainda não tem solicitações neste quadro</p>
                        <Button className="mt-4" onClick={() => navigate("/demands/request")}>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar Solicitação
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* All Board Requests Tab (Requester) */}
          <TabsContent value="all-board">
            <div className="space-y-4">
              {/* Search, Filter & Pagination bar */}
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className={cn(
                  "group flex items-center transition-all duration-300 ease-in-out rounded-xl border overflow-hidden",
                  searchOpen
                    ? "w-72 sm:w-80 border-primary/40 bg-background shadow-sm ring-1 ring-primary/10"
                    : "w-9 border-border bg-muted/40 hover:bg-background hover:border-[#F28705]/40 hover:shadow-sm"
                )}>
                  <button
                    className={cn(
                      "h-9 w-9 shrink-0 flex items-center justify-center transition-colors rounded-l-xl",
                      searchOpen ? "text-primary" : "text-muted-foreground group-hover:text-[#F28705]"
                    )}
                    onClick={() => {
                      if (searchOpen && searchQuery) {
                        setSearchQuery("");
                      } else {
                        setSearchOpen(!searchOpen);
                        if (searchOpen) setSearchQuery("");
                      }
                    }}
                  >
                    {searchOpen && searchQuery ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  </button>
                  {searchOpen && (
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por título, prioridade ou serviço..."
                      className="h-9 w-full bg-transparent text-sm outline-none pr-3 text-foreground placeholder:text-muted-foreground/60"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setSearchQuery("");
                          setSearchOpen(false);
                        }
                      }}
                    />
                  )}
                </div>

                {/* Filter toggle */}
                <Button
                  variant={filtersOpen ? "secondary" : "outline"}
                  size="sm"
                  className={cn(
                    "gap-2 rounded-lg transition-all",
                    !filtersOpen && "hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
                  )}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filtros</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
                </Button>

                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                  >
                    Limpar busca
                  </Button>
                )}

                {/* Results count right */}
                <div className="ml-auto flex items-center gap-2">
                  {paginatedAllBoard.totalItems > 0 && <span className="text-xs text-muted-foreground">{paginatedAllBoard.totalItems} resultado{paginatedAllBoard.totalItems !== 1 ? "s" : ""}</span>}
                </div>
              </div>

              {/* Expanded filters panel */}
              {filtersOpen && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4 animate-fade-in">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "all", label: "Todas", icon: null },
                        { value: "pending", label: "Pendentes", icon: Clock },
                        { value: "approved", label: "Aprovadas", icon: CheckCircle },
                        { value: "returned", label: "Devolvidas", icon: RotateCcw },
                      ].map((tab) => {
                        const TabIcon = tab.icon;
                        const count = tab.value === "all"
                          ? allBoardRequests.length
                          : allBoardRequests.filter((r: any) => r.status === tab.value).length;
                        const isActive = myStatusFilter === tab.value;
                        return (
                          <button
                            key={tab.value}
                            onClick={() => setMyStatusFilter(tab.value)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                              isActive
                                ? "bg-primary/10 border-primary text-primary shadow-sm"
                                : "bg-background border-border text-muted-foreground hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
                            )}
                          >
                            {TabIcon && <TabIcon className="h-3.5 w-3.5" />}
                            {tab.label}
                            <span className={cn(
                              "text-xs rounded-full px-1.5 py-0.5 min-w-5 text-center",
                              isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(pendingLoading || approvedLoading || returnedLoading) ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : paginatedAllBoard.items.length > 0 ? (
              <>
                <div className="grid gap-4 mt-4">
                  {paginatedAllBoard.items.map((request: any) => (
                    <Card
                      key={request.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setViewing(request)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{request.title}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {request.profiles?.full_name || "Usuário"}
                              </span>
                              <span>•</span>
                              <span>{formatDateOrFallback(request.created_at, "dd/MM/yyyy HH:mm")}</span>
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={priorityColors[request.priority || "média"]}>
                              {request.priority || "média"}
                            </Badge>
                            <Badge variant={request.status === "pending" ? "secondary" : request.status === "approved" ? "default" : "destructive"}>
                              {request.status === "pending" ? "Pendente" : request.status === "approved" ? "Aprovada" : "Devolvida"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      {request.service?.name && (
                        <CardContent className="pt-0 pb-3">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" />
                            {request.service.name}
                          </span>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
                {renderPaginationBar(allBoardPage, setAllBoardPage, paginatedAllBoard.totalPages, paginatedAllBoard.totalItems)}
              </>
            ) : (
              renderEmptyState("Não há solicitações neste quadro")
            )}
          </TabsContent>

          {/* Admin view within requester tabs */}
          {canApproveOrReturn && (
            <TabsContent value="admin">
              <div className="space-y-4">
                {renderUnifiedAdminToolbar()}
                {(pendingLoading || approvedLoading || returnedLoading) ? (
                  <div className="text-center py-12 text-muted-foreground">Carregando...</div>
                ) : paginatedAdmin.items.length > 0 ? (
                  <>
                    <div className="grid gap-4">
                      {paginatedAdmin.items.map(request => renderRequestCard(request, request.status === "returned"))}
                    </div>
                    {renderPaginationBar(adminPage, setAdminPage, paginatedAdmin.totalPages, paginatedAdmin.totalItems)}
                  </>
                ) : (
                  renderEmptyState((adminSearchQuery || adminStatusFilter !== "all" || adminPriorityFilter !== "all" || adminDateFilter)
                    ? "Nenhuma solicitação encontrada com os filtros aplicados"
                    : "Não há solicitações neste quadro")
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      ) : (
        /* Non-requester unified view (admin/coordinator/agent) - no tabs */
        <div className="space-y-4">
          {renderUnifiedAdminToolbar()}
          {(pendingLoading || approvedLoading || returnedLoading) ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : paginatedAdmin.items.length > 0 ? (
            <>
              <div className="grid gap-4">
                {paginatedAdmin.items.map(request => renderRequestCard(request, request.status === "returned"))}
              </div>
              {renderPaginationBar(adminPage, setAdminPage, paginatedAdmin.totalPages, paginatedAdmin.totalItems)}
            </>
          ) : (
            renderEmptyState((adminSearchQuery || adminStatusFilter !== "all" || adminPriorityFilter !== "all" || adminDateFilter)
              ? "Nenhuma solicitação encontrada com os filtros aplicados"
              : "Não há solicitações neste quadro")
          )}
        </div>
      )}

      {/* View Details Dialog */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="my-[4px]">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <Layout className="h-3 w-3 mr-1" />
                {viewing?.board?.name || "Quadro"}
              </Badge>
              {getStatusBadge(viewing?.status || "pending")}
            </div>
            <DialogTitle className="text-xl">{viewing?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={viewing?.creator?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(viewing?.creator?.full_name || "?")}
                </AvatarFallback>
              </Avatar>
              <span>
                <button
                  type="button"
                  onClick={() => viewing?.created_by && navigate(`/user/${viewing.created_by}`)}
                  className="hover:text-primary hover:underline cursor-pointer transition-colors"
                >
                  {viewing?.creator?.full_name}
                </button>
                {" "}•{" "}
                {viewing && format(new Date(viewing.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${priorityColors[viewing?.priority || "média"]} border`}>
                Prioridade: {viewing?.priority || "média"}
              </Badge>
              {viewing?.service && (
                <Badge variant="outline">
                  {viewing.service.name} ({viewing.service.estimated_hours}h)
                </Badge>
              )}
            </div>

            {viewing?.description && (
              <div className="space-y-1">
                <Label className="text-sm font-medium">Descrição</Label>
                <div className="p-3 rounded-md bg-muted text-sm overflow-hidden">
                  <RichTextDisplay content={viewing.description} />
                </div>
              </div>
            )}

            {viewing?.status === "returned" && viewing?.rejection_reason && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">Motivo da devolução:</p>
                <div className="text-sm">
                  <RichTextDisplay content={viewing.rejection_reason} />
                </div>
              </div>
            )}

            {(viewing?.status === "approved" || viewing?.status === "returned") && viewing?.responder && (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                <span className="font-medium">{viewing.status === "approved" ? "Aprovada" : "Devolvida"}</span> por{" "}
                <button
                  type="button"
                  onClick={() => viewing?.responded_by && navigate(`/user/${viewing.responded_by}`)}
                  className="font-medium hover:text-primary hover:underline cursor-pointer transition-colors"
                >
                  {viewing.responder.full_name}
                </button>
                {viewing.responded_at && (
                  <span> em {format(new Date(viewing.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                )}
              </div>
            )}

            {viewing && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Paperclip className="h-4 w-4" />
                  Anexos da demanda principal
                </Label>
                <div className="border rounded-lg p-3">
                  <RequestAttachmentUploader requestId={viewing.id} readOnly subdemandIndex={null} />
                </div>
              </div>
            )}

            {viewing && Array.isArray((viewing as any).subdemands_plan) && (viewing as any).subdemands_plan.length > 0 && (
              <SubdemandsPlanSection
                requestId={viewing.id}
                boardId={viewing.board_id}
                plan={(viewing as any).subdemands_plan}
              />
            )}

            <div className="space-y-3 pt-4 border-t">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" />
                Comentários ({comments?.length || 0})
              </Label>
              
              <div className="space-y-2">
                <MentionInput 
                  value={commentText} 
                  onChange={setCommentText} 
                  boardId={viewing?.board_id || selectedBoardId || ""} 
                  placeholder="Adicione um comentário... Use @ para mencionar" 
                  className="min-h-[60px]" 
                  allowedRoles={["admin", "moderator", "executor"]} 
                />
                
                <div className="flex items-center gap-2">
                  <Button onClick={handleAddComment} disabled={!commentText.trim() || createComment.isPending || uploadAttachment.isPending} size="sm">
                    <Send className="h-4 w-4 mr-2" />
                    {createComment.isPending || uploadAttachment.isPending ? "Enviando..." : "Enviar"}
                  </Button>
                  <CommentAttachmentUploader pendingFiles={pendingFiles} onFilesChange={setPendingFiles} disabled={createComment.isPending || uploadAttachment.isPending} buttonOnly />
                  {pendingFiles.length > 0 && (
                    <span className="text-xs text-muted-foreground">{pendingFiles.length}/5 arquivos</span>
                  )}
                </div>
                
                <CommentAttachmentUploader pendingFiles={pendingFiles} onFilesChange={setPendingFiles} disabled={createComment.isPending || uploadAttachment.isPending} filesListOnly />
              </div>

              <ScrollArea className="max-h-48">
                <div className="space-y-3 pr-2">
                  {commentsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Carregando comentários...</p>
                  ) : comments && comments.length > 0 ? (
                    comments.map(comment => (
                      <div key={comment.id} className="flex gap-2 p-3 bg-muted/50 rounded-lg group">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(comment.profiles?.full_name || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/user/${comment.user_id}`);
                              }}
                              className="text-sm font-medium hover:text-primary hover:underline cursor-pointer transition-colors"
                            >
                              {comment.profiles?.full_name}
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                              {user?.id === comment.user_id && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteComment(comment.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="text-sm mt-0.5">
                            <RichTextDisplay content={comment.content} />
                          </div>
                          <CommentAttachments commentId={comment.id} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhum comentário ainda</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Actions for admins/moderators */}
            {canApproveOrReturn && (viewing?.status === "pending" || viewing?.status === "returned") && (
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button 
                  onClick={e => {
                    e.stopPropagation();
                    setViewing(null);
                    openApproveDialog(viewing);
                  }} 
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {viewing?.status === "returned" ? "Reaprovar e Criar Demanda" : "Aprovar e Criar Demanda"}
                </Button>
                {viewing?.status === "pending" && (
                  <Button 
                    variant="outline" 
                    onClick={e => {
                      e.stopPropagation();
                      setViewing(null);
                      setReturning(viewing);
                    }} 
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Devolver para Revisão
                  </Button>
                )}
              </div>
            )}

            {/* Actions for requester editing */}
            {isRequester && user?.id === viewing?.created_by && (viewing?.status === "pending" || viewing?.status === "returned") && (
              <div className="flex gap-2 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" size="sm" onClick={() => { setViewing(null); openEditDialog(viewing); }}>
                  <Edit className="h-4 w-4 mr-1" />
                  {viewing?.status === "returned" ? "Editar e Reenviar" : "Editar"}
                </Button>
                {viewing?.status === "pending" && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setViewing(null); handleDeleteRequest(viewing.id); }}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approving} onOpenChange={() => setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approving?.status === "returned" ? "Reaprovar Solicitação" : "Aprovar Solicitação"}</DialogTitle>
            <DialogDescription>
              Configure os responsáveis e a data de vencimento para criar a demanda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="p-3 rounded-md bg-muted">
              <p className="font-medium">{approving?.title}</p>
              {approving?.description && <p className="text-sm text-muted-foreground mt-1">{approving.description}</p>}
            </div>

            {approving && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Demanda Principal</Label>
                <div className="border rounded-lg p-3">
                  <RequestAttachmentUploader requestId={approving.id} readOnly subdemandIndex={null} />
                </div>
              </div>
            )}

            {approving && Array.isArray((approving as any).subdemands_plan) && (approving as any).subdemands_plan.length > 0 && (
              <SubdemandsPlanSection
                requestId={approving.id}
                boardId={approving.board_id}
                plan={(approving as any).subdemands_plan}
              />
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Responsáveis
              </Label>
              <AssigneeSelector teamId={selectedTeamId} boardId={selectedBoardId} selectedUserIds={assigneeIds} onChange={setAssigneeIds} />
            </div>

            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              {approving?.service && (
                <p className="text-xs text-muted-foreground">
                  Prazo sugerido: {approving.service.estimated_hours}h a partir da aprovação (dias úteis)
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setApproving(null)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleApprove} disabled={approveRequest.isPending} className="flex-1">
                {approveRequest.isPending ? "Criando..." : (approving?.status === "returned" ? "Reaprovar e Criar" : "Aprovar e Criar")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={!!returning} onOpenChange={() => setReturning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo para devolver a solicitação ao solicitante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-muted">
              <p className="font-medium">{returning?.title}</p>
            </div>

            <div className="space-y-2">
              <Label>Motivo da devolução *</Label>
              <MentionInput 
                value={returnReason} 
                onChange={setReturnReason} 
                boardId={returning?.board_id || selectedBoardId || ""}
                placeholder="Descreva os ajustes necessários... Use # para mencionar demandas"
                className="min-h-[80px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setReturning(null)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleReturn} disabled={returnRequest.isPending || !returnReason.trim()} className="flex-1">
                {returnRequest.isPending ? "Enviando..." : "Devolver"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/Resubmit Dialog (Requester) */}
      <Dialog open={!!editingRequest} onOpenChange={() => setEditingRequest(null)}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingRequest?.status === "returned" ? "Editar e Reenviar Solicitação" : "Editar Solicitação"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <form onSubmit={handleResubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <RichTextEditor value={editDescription} onChange={setEditDescription} minHeight="100px" placeholder="Descreva sua solicitação..." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="média">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <ServiceSelector
                    teamId={editingRequest?.team_id}
                    boardId={editingRequest?.board_id || selectedBoardId}
                    value={editServiceId}
                    onChange={setEditServiceId}
                  />
                </div>
              </div>

              {editingRequest && (
                <div className="border-t pt-4">
                  <RequestAttachmentUploader requestId={editingRequest.id} />
                </div>
              )}
              
              <div className="flex gap-2 pt-2 pb-1">
                <Button type="button" variant="outline" onClick={() => setEditingRequest(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateRequest.isPending} className="flex-1">
                  {updateRequest.isPending ? "Salvando..." : editingRequest?.status === "returned" ? "Reenviar" : "Salvar"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRequest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
