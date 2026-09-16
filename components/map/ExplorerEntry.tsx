import { getUser } from "@/lib/auth/session";
import { toPublicOperator, verifiedOperators } from "@/lib/data/operators";
import ExplorerApp from "./ExplorerApp";

/** Server entry for the public map pages: loads the viewer and the catalogue together. */
export default async function ExplorerEntry() {
  const [user, source] = await Promise.all([getUser(), verifiedOperators()]);
  return <ExplorerApp initialUser={user} operators={source.map(toPublicOperator)}/>;
}
