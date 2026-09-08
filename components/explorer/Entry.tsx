import { getUser } from "@/lib/auth";
import { nodes } from "../Landing/nodes";
import ExplorerApp from "./ExplorerApp";

export default async function Entry({ dashboard = false }: { dashboard?: boolean }) {
  const user = await getUser();
  const operators = nodes.map(({ id, slug, name, city, country, coordinates, type, modalities, capacity, media }) => ({ id, slug, name, city, country, coordinates, type, modalities, capacity, media }));
  return <ExplorerApp initialUser={user} operators={operators} initialDashboard={dashboard}/>;
}
