import type { Metadata } from "next";

import { PLANS, TOPUPS } from "../../server/billing";
import { platformOn } from "../../server/platform";
import { Pricing } from "./pricing";

export const metadata: Metadata = { title: "Plans — haggs" };

export default function PricingPage() {
  return <Pricing packs={TOPUPS.map(({priceEnv:_hidden,...p})=>p)} plans={PLANS.map(({ priceEnv: _hidden, ...p }) => p)} credits={platformOn()} />;
}
