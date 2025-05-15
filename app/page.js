import React from "react";
import IdeasListPage from "../components/IdeaList";

export async function generateMetadata() {
  const frame = {
    version: "next",
    imageUrl: "https://coincept.world/coincept.png",
    button: {
      title: "Launch",
      action: {
        type: "launch_frame",
        url: `https://coincept.world/`,
        name: "Coincept",
        splashImageUrl: "https://coincept.world/globe.svg",
        splashBackgroundColor: "#f5f0ec",
      },
    },
  };

  return {
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

function page() {
  return (
    <div>
      <IdeasListPage />
    </div>
  );
}

export default page;
