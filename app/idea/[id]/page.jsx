import IdeaPage from "../../../components/IdeaPage";
import { readContract } from "@wagmi/core";
import { coincept_abi, coincept_address ,erc20abi} from "../../../lib/constants";
import { base } from "viem/chains";
import { createConfig } from "wagmi";
import { http } from "viem";

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http("https://base-mainnet.g.alchemy.com/v2/rgLw9ASxDjV4MABUX8q3jYH8rQg1vYTj"),
  },
  ssr: true,
});

const getIdeaMetadata = async (i) => {
  const metadata = await readContract(config, {
    abi: coincept_abi,
    address: coincept_address,
    functionName: "getContestMetadata",
    args: [i],
  });

  // @ts-ignore
  const tokenAddress = metadata.voteToken;

  const tokenName = await readContract(config, {
    abi: erc20abi,
    address: tokenAddress,
    functionName: "name",
  });

  const tokenSymbol = await readContract(config, {
    abi: erc20abi,
    address: tokenAddress,
    functionName: "symbol",
  });

  return {
    // @ts-ignore
    ...metadata,
    tokenName,
    tokenSymbol,
  };
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const metadata = await getIdeaMetadata(id);
  console.log(metadata);

  const frame = {
    version: "next", 
    imageUrl:
      "https://coincept.vercel.app/api/token-image?tokenName=" + metadata.tokenName + "&ticker=" + metadata.tokenSymbol + "&creator=" + metadata.creator,
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
