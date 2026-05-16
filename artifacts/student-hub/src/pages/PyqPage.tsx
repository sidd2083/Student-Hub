import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function PyqPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/pyqs");
  }, [setLocation]);

  return null;
}
