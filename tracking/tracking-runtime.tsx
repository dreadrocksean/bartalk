// Mounts the trackee-side publisher inside the tracking provider. Separate from
// the provider itself so the publisher can read the link graph it depends on.

import { useLocationPublisher } from "../hooks/use-location-publisher";

export const TrackingRuntime = () => {
  useLocationPublisher();
  return null;
};
