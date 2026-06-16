import { useState, useCallback, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ZoomIn, RotateCw, Trophy, Eye, Crop } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  aspectRatio?: number;
  onCropComplete: (croppedImageBlob: Blob) => void;
  userAvatarUrl?: string;
  userName?: string;
  userLevel?: number;
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  aspectRatio = 4 / 1,
  onCropComplete,
  userAvatarUrl,
  userName = "Usuário",
  userLevel = 1,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("crop");

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteHandler = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const createCroppedImage = async (): Promise<Blob> => {
    if (!croppedAreaPixels) throw new Error("No cropped area");

    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas context");

    // Calculate the rotated bounding box
    const radians = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const rotatedWidth = image.width * cos + image.height * sin;
    const rotatedHeight = image.width * sin + image.height * cos;

    // Create a canvas for the rotated image
    const rotatedCanvas = document.createElement("canvas");
    rotatedCanvas.width = rotatedWidth;
    rotatedCanvas.height = rotatedHeight;
    const rotatedCtx = rotatedCanvas.getContext("2d");
    if (!rotatedCtx) throw new Error("No rotated canvas context");

    rotatedCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
    rotatedCtx.rotate(radians);
    rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);

    // Set output canvas size
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    // Draw the cropped area
    ctx.drawImage(
      rotatedCanvas,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        "image/jpeg",
        0.9
      );
    });
  };

  // Generate preview when crop area changes
  useEffect(() => {
    const generatePreview = async () => {
      if (!croppedAreaPixels || !imageSrc) return;
      
      try {
        const image = new Image();
        image.src = imageSrc;
        await new Promise((resolve) => (image.onload = resolve));

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const radians = (rotation * Math.PI) / 180;
        const sin = Math.abs(Math.sin(radians));
        const cos = Math.abs(Math.cos(radians));
        const rotatedWidth = image.width * cos + image.height * sin;
        const rotatedHeight = image.width * sin + image.height * cos;

        const rotatedCanvas = document.createElement("canvas");
        rotatedCanvas.width = rotatedWidth;
        rotatedCanvas.height = rotatedHeight;
        const rotatedCtx = rotatedCanvas.getContext("2d");
        if (!rotatedCtx) return;

        rotatedCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
        rotatedCtx.rotate(radians);
        rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);

        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        ctx.drawImage(
          rotatedCanvas,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );

        setPreviewUrl(canvas.toDataURL("image/jpeg", 0.8));
      } catch (error) {
        console.error("Error generating preview:", error);
      }
    };

    const debounce = setTimeout(generatePreview, 100);
    return () => clearTimeout(debounce);
  }, [croppedAreaPixels, imageSrc, rotation]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const croppedBlob = await createCroppedImage();
      onCropComplete(croppedBlob);
      onOpenChange(false);
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setPreviewUrl(null);
    setActiveTab("crop");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar Imagem do Banner</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="crop" className="gap-2">
              <Crop className="h-4 w-4" />
              Recortar
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Visualizar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crop" className="mt-4 space-y-4">
            <div className="relative h-64 md:h-72 bg-muted rounded-lg overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspectRatio}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropCompleteHandler}
                classes={{
                  containerClassName: "rounded-lg",
                }}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setZoom(value[0])}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-12">{zoom.toFixed(1)}x</span>
              </div>

              <div className="flex items-center gap-4">
                <RotateCw className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[rotation]}
                  min={0}
                  max={360}
                  step={1}
                  onValueChange={(value) => setRotation(value[0])}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-12">{rotation}°</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Visualização de como o banner aparecerá no seu perfil:
            </p>
            
            {/* Profile Preview Card */}
            <div className="rounded-xl overflow-hidden border bg-card shadow-lg">
              {/* Banner Preview - using exact aspect ratio */}
              <div className="relative w-full" style={{ aspectRatio: `${aspectRatio}` }}>
                {previewUrl ? (
                  <>
                    <img 
                      src={previewUrl} 
                      alt="Preview do banner" 
                      className="absolute inset-0 w-full h-full object-fill"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-secondary/60">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>
                )}

                {/* Level Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 z-10 border border-white/10">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  <span className="text-white font-bold text-sm">Nível {userLevel}</span>
                </div>

                {/* Decorative bottom edge */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
              </div>

              {/* Profile Info Preview */}
              <div className="relative px-4 pb-4">
                {/* Avatar */}
                <div className="absolute -top-10 left-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20 border-4 border-background shadow-xl">
                      <AvatarImage src={userAvatarUrl} className="object-cover" />
                      <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                        {getInitials(userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold border-2 border-background shadow">
                      {userLevel}
                    </div>
                  </div>
                </div>

                {/* Name area */}
                <div className="pt-12 pl-1">
                  <h3 className="text-lg font-bold">{userName}</h3>
                  <p className="text-sm text-muted-foreground">Seu perfil personalizado</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              "Aplicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
