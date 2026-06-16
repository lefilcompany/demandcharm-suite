import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CreateTeam() {
  const navigate = useNavigate();

  // Redirect to the unified get-started flow
  useEffect(() => {
    navigate("/get-started", { replace: true });
  }, [navigate]);

  return null;
}
