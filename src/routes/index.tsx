import { createFileRoute } from "@tanstack/react-router";
import PolishedFilm from "@/components/PolishedFilm";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <PolishedFilm />;
}
