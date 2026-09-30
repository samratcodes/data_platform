import { getUser } from "@/lib/auth/session";
import { toPublicOperator, verifiedOperators } from "@/lib/data/operators";
import ExplorerApp from "./ExplorerApp";

/** Server entry for the public map pages: loads the viewer and the catalogue together. */
export default async function ExplorerEntry() {
  const [user, source] = await Promise.all([getUser(), verifiedOperators()]);
  const operators = source.map(toPublicOperator);
  // Signed-out visitors never receive facility listings; they only see how many exist.
  const facilityTotal = operators.filter((operator) => operator.type === "Facility").length;
  return <ExplorerApp initialUser={user} operators={user ? operators : operators.filter((operator) => operator.type !== "Facility")} facilityTotal={facilityTotal}/>;
}
