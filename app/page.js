"use client";
import React, { useState, useEffect } from "react";
import { readContract } from "@wagmi/core";
import { Loader2 } from "lucide-react";
import { config } from "../lib/providers";
import { coincept_abi, coincept_address } from "../lib/constants";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { erc20abi } from "../lib/constants";
import { sdk } from "@farcaster/frame-sdk";
import { ProfileCard } from "../components/IdeaPage";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const IdeaCard = ({ idea }) => {
  return (
    <Link
      href={`/idea/${idea.id}`}
      className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full"
    >
      {/* @ts-ignore */}
      {idea.voteToken && (
        <div className="w-full h-48 overflow-hidden">
          <iframe
            // @ts-ignore
            src={`https://www.geckoterminal.com/base/pools/${idea.voteToken}?embed=1&grayscale=0&info=0&light_chart=0&swaps=0`}
            title={idea.title}
            className="w-full h-full border-0"
          />
        </div>
      )}
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-semibold text-gray-900">{idea.title}</h3>
          {/* <div className="bg-purple-100 dark:bg-purple-900 rounded-full px-3 py-1 text-sm font-medium text-purple-800 dark:text-purple-200 flex items-center">
            <Coins size={14} className="mr-1" />
            ${idea.tokenPrice}
          </div> */}
        </div>
        <p className="text-gray-600 mb-4 flex-grow line-clamp-3">
          {idea.description}
        </p>
        <div className="mt-auto flex justify-between items-center">
          <span className="text-sm text-gray-500">
            <span
              onClick={(e) => {
                e.preventDefault();
                // @ts-ignore
                navigator.clipboard.writeText(idea.voteToken);
                alert("Token copied to clipboard");
              }}
              className="cursor-pointer hover:text-indigo-600"
            >
              Token: {idea.tokenSymbol}
            </span>
          </span>
          <span className="inline-flex items-center text-indigo-600 font-medium group-hover:translate-x-1 transition-transform">
            View Details <ArrowUpRight size={16} className="ml-1" />
          </span>
        </div>
      </div>
    </Link>
  );
};

const getIdeas = async () => {
  const result = await readContract(config, {
    abi: coincept_abi,
    address: coincept_address,
    functionName: "contestCount",
  });
  const totalContests = Number(result);
  const promises = Array.from({ length: totalContests }, async (_, i) => {
    const metadata = await readContract(config, {
      abi: coincept_abi,
      address: coincept_address,
      functionName: "getContestMetadata",
      args: [i],
    });
    // @ts-ignore
    const tokenAddress = metadata.voteToken; // Assuming voteToken is 4th item in metadata

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
      title: tokenName,
      tokenSymbol,
      id: i,
      // @ts-ignore
      description: metadata.ideaDescription,
    };
  });

  const contests = await Promise.all(promises);
  return contests.reverse();
};

const IdeasListPage = () => {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const { address } = useAccount();

  useEffect(() => {
    const init = async () => {
      await sdk.actions.ready();
    };
    init();
  }, []);

  useEffect(() => {
    getIdeas().then((result) => {
      setIdeas(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-4 pb-16 bg-gray-50 min-h-screen">
      <div style={{ display: "none" }}>
        <ConnectButton />
      </div>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center max-w-4xl mx-auto mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-indigo-600 hover:underline"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Coincept
            </h1>
          </Link>
          <ProfileCard address={address} />
        </div>

        {/* Ideas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ideas.length > 0 ? (
            ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} />)
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-lg text-gray-500">
                No ideas found matching your search. Try a different keyword.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdeasListPage;
