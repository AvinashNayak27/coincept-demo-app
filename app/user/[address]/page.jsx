"use client";
import Link from "next/link";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { ProfileCard } from "../../../components/IdeaPage";
import { readContract } from "@wagmi/core";
import { coincept_address, coincept_abi } from "../../../lib/constants";
import { useState, useEffect } from "react";
import { config } from "../../../lib/providers";
import { use } from "react";

const getContest = async (contestId) => {
  const contest = await readContract(config, {
    address: coincept_address,
    abi: coincept_abi,
    functionName: "getContestMetadata",
    args: [contestId],
  });
  return contest;
};

const getFees = async (positionId) => {
  try {
    const res = await fetch(`/api/get-fees?nftId=${positionId}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching fees:", err);
    return null;
  }
};

const getOGData = async (url) => {
  try {
    const response = await fetch(url);
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
    };

    return ogData;
  } catch (err) {
    console.error("Error fetching OG data:", err);
    return null;
  }
};

const getUserProfile = async (address, isBuilds = false) => {
  const userContests = await readContract(config, {
    address: coincept_address,
    abi: coincept_abi,
    functionName: isBuilds ? "getBuildsByUser" : "getContestsByUser",
    args: [address],
  });

  const contestsWithMetadata = await Promise.all(
    userContests.map(async (contest) => {
      const contestId = isBuilds ? contest.contestId : contest;
      const metadata = await getContest(contestId);
      let fees = null;
      if (metadata.positionId) {
        fees = await getFees(metadata.positionId);
      }

      if (isBuilds) {
        const build = metadata.builds[contest.buildIndex];
        let ogData = null;
        if (build?.buildLink) {
          ogData = await getOGData(build.buildLink);
        }
        return {
          id: contestId,
          buildIndex: contest.buildIndex,
          ...metadata,
          build,
          fees,
          ogData,
        };
      }

      return {
        id: contestId,
        ...metadata,
        fees,
      };
    })
  );

  return contestsWithMetadata;
};

const UserPage = ({ address }) => {
  const [contests, setContests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ideas");

  const handleTabChange = (tab) => {
    setIsLoading(true);
    setActiveTab(tab);
  };

  useEffect(() => {
    const fetchData = async () => {
      const data = await getUserProfile(address, activeTab === "builds");
      console.log({
        data,
        activeTab,
      });
      setContests(data);
      setIsLoading(false);
    };
    fetchData();
  }, [address, activeTab]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange("ideas")}
            className={`${
              activeTab === "ideas"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Ideas
          </button>
          <button
            onClick={() => handleTabChange("builds")}
            className={`${
              activeTab === "builds"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Builds
          </button>
        </nav>
      </div>

      {activeTab === "ideas" ? (
        contests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No ideas yet. Tag @0xcoincept on Warpcast and launch!
          </div>
        ) : (
          <div className="space-y-6">
            {contests.map((contest, index) => (
              <Link href={`/idea/${contest.id}`} key={index}>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-gray-800 text-base mb-4">
                    {contest.ideaDescription}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                    {contest.fees &&
                    contest.fees.ideaCurator.fee0.toFixed(5) > 0 ? (
                      <>
                        <div className="text-sm text-gray-700 space-y-1 mb-4 sm:mb-0">
                          <p>
                            {contest.fees.ideaCurator.fee0.toFixed(5)}
                            <span className="font-medium text-gray-600">
                              {" "}
                              {contest.fees.token0name}
                            </span>
                          </p>
                          <p>
                            {contest.fees.ideaCurator.fee1.toFixed(5)}
                            <span className="font-medium text-gray-600">
                              {" "}
                              {contest.fees.token1name}
                            </span>
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            alert("Claim logic goes here");
                          }}
                          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
                        >
                          Claim Fees
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-sm text-gray-500 border border-gray-300 bg-white rounded-md p-3 text-center italic">
                        No fees available yet
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : contests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No builds yet. Start building on existing ideas!
        </div>
      ) : (
        <div className="space-y-6">
          {contests.map((contest, index) => (
            <div
              key={index}
              className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col space-y-4">
                {contest.build?.buildLink ? (
                  <div>
                    {contest.ogData && (
                      <div className="mt-3">
                        <h3 className="text-lg font-medium text-gray-900">
                          {contest.ogData.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {contest.ogData.description}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500 italic">
                    No build link available
                  </span>
                )}
                <div className="flex justify-between items-center">
                  <a
                    href={contest.build.buildLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                  >
                    View Build <ExternalLink size={14} className="ml-1" />
                  </a>

                  <Link
                    href={`/idea/${contest.id}`}
                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                  >
                    View Idea <ExternalLink size={14} className="ml-1" />
                  </Link>

                  <p className="text-sm text-gray-500">
                    {contest.build?.voteCount || 0} votes
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-4">
                {contest.fees && contest.fees.builder.fee0.toFixed(5) > 0 ? (
                  <>
                    <div className="text-sm text-gray-700 space-y-1 mb-4 sm:mb-0">
                      <p>
                        {contest.fees.builder.fee0.toFixed(5)}
                        <span className="font-medium text-gray-600">
                          {" "}
                          {contest.fees.token0name}
                        </span>
                      </p>
                      <p>
                        {contest.fees.builder.fee1.toFixed(5)}
                        <span className="font-medium text-gray-600">
                          {" "}
                          {contest.fees.token1name}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        alert("Claim logic goes here");
                      }}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
                    >
                      Claim Fees
                    </button>
                  </>
                ) : (
                  <div className="w-full text-sm text-gray-500 border border-gray-300 bg-white rounded-md p-3 text-center italic">
                    No fees available yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function UserPageHome({ params }) {
  const unwrappedParams = use(params);
  const { address } = unwrappedParams;

  return (
    <div className="pt-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/ideas"
            className="inline-flex items-center  hover:underline"
          >
            <ArrowLeft size={18} className="mr-2" />
          </Link>
          <ProfileCard address={address} />
        </div>

        <UserPage address={address} />
      </div>
    </div>
  );
}
