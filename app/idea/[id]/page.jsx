import IdeaPage from "../../../components/IdeaPage";

export async function generateMetadata({ params }) {
  const id = params.id;
  const frame = {
    version: "next",
    imageUrl:
      "https://devfolio-prod.s3.ap-south-1.amazonaws.com/hackathons/f83b2f48642548c485ceb162047645a3/projects/1a421f4925e64ecda38854da6cc85072/910bc1d1-76c1-462c-9676-1304a88e6c61.jpeg",
    button: {
      title: "View Coincept",
      action: {
        type: "launch_frame",
        url: `https://coincept-demo.vercel.app/idea/${id}`,
        name: "Yoink!",
        splashImageUrl:
          "https://devfolio-prod.s3.ap-south-1.amazonaws.com/hackathons/f83b2f48642548c485ceb162047645a3/projects/1a421f4925e64ecda38854da6cc85072/910bc1d1-76c1-462c-9676-1304a88e6c61.jpeg",
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
