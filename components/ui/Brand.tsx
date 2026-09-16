import Image from "next/image";
import Link from "next/link";

export default function Brand() {
  return <Link href="/" className="brand" aria-label="map.filemarket home">
    <Image className="brand-logo" src="/brand-logo.png" alt="" width={64} height={64} priority/>
    <span>map<span className="brand-light">.filemarket</span><small>THE WORLD IS YOUR DATASET</small></span>
  </Link>;
}
