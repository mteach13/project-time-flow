import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-center space-y-4">
        <div className="text-7xl font-serif">404</div>
        <p className="text-muted-foreground">This page doesn't exist.</p>
        <Button asChild><Link to="/">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
