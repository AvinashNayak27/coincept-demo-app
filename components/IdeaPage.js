"use client";
import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  DollarSign,
  Coins,
  User,
  Loader2,
  Clock,
  ArrowDown,
} from "lucide-react";
import { X } from "lucide-react";
import { config } from "../lib/providers";
import { coincept_address, coincept_abi, erc20abi } from "../lib/constants";
import { readContract } from "@wagmi/core";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWriteContract } from "wagmi";
import Link from "next/link";
import { ThumbsUp, ExternalLink } from "lucide-react";

const BuildCard = ({ build, onVote, displayVotes }) => {
  const [ogData, setOgData] = useState({});

  useEffect(() => {
    const fetchOGData = async () => {
      if (build.buildLink) {
        console.log("Fetching OG data for:", build.buildLink);
        try {
          const response = await fetch(build.buildLink);
          const text = await response.text();
          const doc = new DOMParser().parseFromString(text, "text/html");

          const ogData = {
            title:
              doc
                .querySelector('meta[property="og:title"]')
                ?.getAttribute("content") ?? undefined,
            description:
              doc
                .querySelector('meta[property="og:description"]')
                ?.getAttribute("content") ?? undefined,
            image:
              doc
                .querySelector('meta[property="og:image"]')
                ?.getAttribute("content") ?? undefined,
          };

          setOgData(ogData);
        } catch (error) {
          console.error("Error fetching OpenGraph data:", error);
        }
      }
    };

    fetchOGData();
  }, [build.buildLink]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden flex flex-col h-full">
      <div className="w-full h-40 overflow-hidden">
        {build.imageUrl || ogData.image ? (
          <img
            src={build.imageUrl || ogData.image}
            alt="Build Image"
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-full h-full text-gray-300 dark:text-gray-600"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm8 3a2 2 0 110 4 2 2 0 010-4zm0 6a4 4 0 110-8 4 4 0 010 8z" />
          </svg>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {build.title || ogData.title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4 flex-grow line-clamp-3">
          {build.description || ogData.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {build.buildLink && (
            <a
              href={build.buildLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full flex items-center"
            >
              <ExternalLink size={12} className="mr-1" /> Project
            </a>
          )}
        </div>

        {displayVotes && (
          <div className="flex justify-between items-center mt-auto">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                {build.voteCount.toString()}
              </span>{" "}
              votes
            </div>
            <button
              onClick={() => onVote(build.id)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-all hover:shadow-md"
            >
              <ThumbsUp size={16} className="mr-2" /> Vote
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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

const IdeaPage = ({ id }) => {
  const [ethAmount, setEthAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [buildLink, setBuildLink] = useState("");
  const [idea, setIdea] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [votingActive, setVotingActive] = useState(false);
  const { data: hash, isPending, writeContract } = useWriteContract();

  useEffect(() => {
    getIdeaMetadata(Number(id)).then((result) => {
      console.log(result);
      setIdea(result);
      setIsLoading(false);

      // Check if voting is active
      const now = Math.floor(Date.now() / 1000);
      const startTime = Number(result.votingStartTime);
      const endTime = Number(result.votingEndTime);
      setVotingActive(now >= startTime && now <= endTime);
    });
  }, []);

  const handleSubmitBuild = async () => {
    try {
      console.log("Submitting build link:", buildLink);

      writeContract({
        address: coincept_address,
        abi: coincept_abi,
        functionName: "submitBuild",
        args: [Number(id), buildLink],
      });
    } catch (error) {
      console.error("Error validating URL:", error);
      alert("Please enter a valid URL");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  // Handle voting
  const handleVote = (buildId) => {
    if (!votingActive) {
      alert("Voting is not currently active");
      return;
    }
    alert(`Voted for build: ${buildId}`);
  };

  if (!idea) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-red-600">Idea not found</h2>
        <Link href="/ideas" className="text-indigo-600 mt-6 inline-block">
          <ArrowLeft className="inline mr-2" size={16} />
          Explore ideas
        </Link>
      </div>
    );
  }

  // Calculate token amount based on ETH input
  const handleEthInput = (value) => {
    setEthAmount(value);
    // This is a placeholder calculation - replace with actual price calculation
    setTokenAmount((Number(value) * Number(idea.tokenPrice)).toString());
  };

  return (
    <>
      <div className="pt-4  bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="max-w-4xl mx-auto flex justify-between items-center mb-4 px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Coincept
          </h1>
          <ConnectButton />
        </div>
        <div className="container mx-auto px-4">
          {/* Back Link */}
          <Link
            href="/ideas"
            className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:underline mb-2 mt-2"
          >
            <ArrowLeft size={16} className="mr-1" /> Back to ideas
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Idea Details */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                {idea.voteToken && (
                  <div className="w-full h-48 overflow-hidden">
                    <iframe
                      src={`https://www.geckoterminal.com/base/pools/${idea.voteToken}?embed=1&grayscale=0&info=0&light_chart=0&swaps=0`}
                      title={idea.title}
                      className="w-full h-full border-0"
                    />
                  </div>
                )}

                <div className="p-6 md:p-8">
                  <div className="flex flex-wrap justify-between items-start mb-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 md:mb-0">
                      {idea.tokenName}
                    </h1>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowBuyModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-medium transition-colors"
                      >
                        Buy ${idea.tokenSymbol}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mb-6 text-sm">
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <User size={16} className="mr-1" />
                      Creator: {idea.creator.substring(0, 6)}...
                      {idea.creator.substring(38)}
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <Coins size={16} className="mr-1" />
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(idea.voteToken);
                        }}
                        className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        Token: {idea.tokenSymbol}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <Clock size={16} className="mr-1" />
                      <span className="hidden md:inline">
                        Voting:{" "}
                        {new Date(
                          Number(idea.votingStartTime) * 1000
                        ).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                          timeZoneName: "shortGeneric",
                        })}{" "}
                        -{" "}
                        {new Date(
                          Number(idea.votingEndTime) * 1000
                        ).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                          timeZoneName: "shortGeneric",
                        })}
                      </span>
                      <span className="md:hidden">
                        Voting:{" "}
                        {new Date(
                          Number(idea.votingStartTime) * 1000
                        ).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                          timeZoneName: "shortGeneric",
                        })}{" "}
                        -{" "}
                        {new Date(
                          Number(idea.votingEndTime) * 1000
                        ).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                          timeZoneName: "shortGeneric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                      Description
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {idea.ideaDescription}
                    </p>
                  </div>

                  {!votingActive && (
                    <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg mb-4">
                      <p>
                        Voting is{" "}
                        {Date.now() / 1000 < Number(idea.votingStartTime)
                          ? "not yet started,but you can still submit a build"
                          : "already ended"}
                        .
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Builds Section */}
              <div className="mt-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
                    Community Builds
                  </h2>
                  <button
                    onClick={() => setShowSubmitModal(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap"
                  >
                    Submit Build
                  </button>
                </div>

                {idea.builds.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {idea.builds.map((build, index) => (
                      <BuildCard
                        key={`${build.buildLink}-${index}`}
                        build={build}
                        onVote={handleVote}
                        displayVotes={votingActive}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      No builds have been submitted for this idea yet.
                    </p>
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium inline-flex items-center transition-all"
                    >
                      Be the first to submit a build
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Buy Modal */}
        <div
          className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 p-6 rounded-t-xl shadow-xl transform transition-transform duration-300 ${
            showBuyModal ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="relative max-w-md mx-auto">
            <button
              onClick={() => setShowBuyModal(false)}
              className="absolute top-0 right-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>

            <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white text-center">
              Swap ETH for {idea.tokenSymbol}
            </h3>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl mb-4">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
                You Pay
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  value={ethAmount}
                  onChange={(e) => handleEthInput(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-transparent text-2xl font-medium text-gray-900 dark:text-white focus:outline-none"
                />
                <div className="flex items-center bg-white dark:bg-gray-600 px-3 py-1 rounded-full">
                  <span className="font-medium text-gray-900 dark:text-white">
                    ETH
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-center -my-2">
              <div className="bg-white dark:bg-gray-700 p-2 rounded-full shadow">
                <ArrowDown size={20} className="text-gray-600 dark:text-gray-300" />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl mt-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
                You Receive
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={tokenAmount}
                  readOnly
                  className="w-full bg-transparent text-2xl font-medium text-gray-900 dark:text-white focus:outline-none"
                  placeholder="0.0"
                />
                <div className="flex items-center bg-white dark:bg-gray-600 px-3 py-1 rounded-full">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {idea.tokenSymbol}
                  </span>
                </div>
              </div>
            </div>

            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-medium mt-6 transition-colors">
              Swap
            </button>
          </div>
        </div>

        {/* Submit Build Modal */}
        <div
          className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 p-6 rounded-t-xl shadow-xl transform transition-transform duration-300 ${
            showSubmitModal ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="relative">
            <button
              onClick={() => setShowSubmitModal(false)}
              className="absolute top-0 right-0 text-red-500 hover:text-red-700 transition-colors"
            >
              <X size={24} />
            </button>

            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Submit Your Build
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Devfolio Link
              </label>
              <input
                type="text"
                value={buildLink}
                onChange={(e) => setBuildLink(e.target.value)}
                placeholder="Enter your Devfolio link"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleSubmitBuild}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-3 rounded-lg font-medium transition-all"
            >
              {isPending ? "Submitting..." : "Submit Build"}
            </button>
            {hash && (
              <div className="mt-4 text-sm text-green-600 dark:text-green-400">
                Build submitted successfully!
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default IdeaPage;
