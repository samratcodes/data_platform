import { getUser } from "@/lib/auth";
import { verifiedOperators } from "@/lib/operators";
import ExplorerApp from "./ExplorerApp";

export default async function Entry() {
  const user = await getUser();
  const source = await verifiedOperators();
  const operators = source.map(({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media }) => ({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media }));
  return <ExplorerApp initialUser={user} operators={operators}/>;
}
