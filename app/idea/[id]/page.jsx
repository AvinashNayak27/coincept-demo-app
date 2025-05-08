import IdeaPage from "../../../components/IdeaPage";

export async function generateMetadata({ params }) {
  const id = params.id;
  const frame = {
    version: "next",
    imageUrl:
      "https://coincept.vercel.app/coincept.png",
    button: {
      title: "View Coincept",
      action: {
        type: "launch_frame",
        url: `https://coincept.vercel.app/idea/${id}`,
        name: "Yoink!",
        splashImageUrl:
          "https://coincept.vercel.app/globe.svg",
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

export default function IdeaPageHome({ params }) {


  const { id } = params;

  return <IdeaPage id={id} />;
}
