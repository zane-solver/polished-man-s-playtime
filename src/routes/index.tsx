import { createFileRoute } from "@tanstack/react-router";
import Sanctuary from "@/components/Sanctuary";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <Sanctuary />;
}
