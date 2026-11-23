import { Administration } from "./panel";

export const dynamic = "force-dynamic";

export default function ControlPage() {
  const socialOrigin = process.env.KILLERWAVE_SOCIAL_ORIGIN ?? "http://localhost:3000";
  return <Administration socialOrigin={socialOrigin} />;
}
