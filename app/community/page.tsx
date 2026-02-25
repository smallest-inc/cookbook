import { Metadata } from "next";
import { CommunityPage } from "./CommunityPage";

export const metadata: Metadata = {
  title: "Community Projects",
  description:
    "Projects built by the Smallest AI community. Submit your own via a pull request.",
};

export default function Page() {
  return <CommunityPage />;
}
