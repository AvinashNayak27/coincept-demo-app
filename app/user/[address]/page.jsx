"use client";
import Link from "next/link";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { ProfileCard } from "../../../components/IdeaPage";
import { readContract } from "@wagmi/core";
import { coincept_address, coincept_abi } from "../../../lib/constants";
import { useState, useEffect } from "react";
import { config } from "../../../lib/providers";
import { use } from "react";
import sdk from "@farcaster/frame-sdk";
import { useWriteContract } from "wagmi";
import { getProfile } from "../../../components/IdeaPage";

// Helper to fetch linked Devfolio profile for a user address
const getDevfolioProfile = async (address) => {
  try {
    // You may want to replace this with your actual API endpoint or logic
    const res = await fetch(`/api/devfolio-profile?address=${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Expected: { devfolioUsername: string | null }
    return data.devfolioUsername || "Avinash";
  } catch (err) {
    return null;
  }
};

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

// UserInfoBar: displays user address and devfolio profile/link
function UserInfoBar({ address }) {
  const [devfolioUsername, setDevfolioUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [farcasterUsername, setFarcasterUsername] = useState(null);
  const [fid, setFid] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profiles = await getProfile(address);
        const addressFromProfile = Object.keys(profiles)[0];
        if (
          addressFromProfile &&
          profiles[addressFromProfile] &&
          profiles[addressFromProfile][0]
        ) {
            setFarcasterUsername(profiles[addressFromProfile][0].username);
            setFid(profiles[addressFromProfile][0].fid);
        } else {
          setFarcasterUsername(null);
          setFid(null);
        }
      } catch (e) {
        setFarcasterUsername(null);
        setFid(null);
      }
    };
    if (address) {
      fetchProfile();
    } else {
      setFarcasterUsername(null);
      setFid(null);
    }
  }, [address]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getDevfolioProfile(address).then((username) => {
      if (!ignore) {
        setDevfolioUsername(username);
        setLoading(false);
      }
    });
    return () => { ignore = true; };
  }, [address]);

  // Simulate linking process (replace with your actual logic)
  const handleLinkDevfolio = async () => {
    setLinking(true);
    // You might want to open a modal or redirect to Devfolio OAuth
    // For now, just simulate
    setTimeout(() => {
      // After linking, refetch
      setLinking(false);
      setDevfolioUsername("your-devfolio-username"); // Replace with actual username
    }, 1500);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="font-mono text-gray-700 text-sm break-all">
          <span className="font-semibold text-gray-900">Address:</span> {address.substring(0, 6) + "..." + address.substring(address.length - 4)}
        </span>
        <span className="font-mono text-gray-700 text-sm break-all">
          <span className="font-semibold text-gray-900">Farcaster:</span>{" "}
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={async () => {
              if (fid) {
                await sdk.actions.viewProfile({ fid });
              }
            }}
            disabled={!fid}
            style={{ background: "none", border: "none", padding: 0, cursor: fid ? "pointer" : "not-allowed" }}
          >
            @{farcasterUsername}
          </button>
        </span>
        <span className="hidden sm:inline-block mx-3 text-gray-300">|</span>
        {/* <span className="text-sm text-gray-700 flex items-center gap-2">
          <span className="font-semibold text-gray-900">Devfolio:</span>
          {loading ? (
            <span className="text-gray-400">Loading...</span>
          ) : devfolioUsername ? (
            <a
              href={`https://devfolio.co/@${devfolioUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center"
            >
              @{devfolioUsername}
              <ExternalLink size={14} className="ml-1" />
            </a>
          ) : (
            <button
              onClick={handleLinkDevfolio}
              disabled={linking}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-md text-xs font-medium transition disabled:opacity-60"
            >
              {linking ? "Linking..." : "Link Devfolio Profile"}
            </button>
          )}
        </span> */}
      </div>
    </div>
  );
}

const UserPage = ({ address }) => {
  const [contests, setContests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ideas");
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const { data: hash, isPending, writeContractAsync } = useWriteContract();

  useEffect(() => {
    if (hash) {
      alert("Fees claimed successfully");
    }
  }, [hash]);

  const handleClaimFees = async (contestId) => {
    try {
      const contest = contests.find((c) => c.id === contestId);
      if (!contest) {
        throw new Error("Contest not found");
      }

      await writeContractAsync({
        address: coincept_address,
        abi: coincept_abi,
        functionName: "claimRewards",
        args: [contestId],
      });
    } catch (error) {
      console.error("Error claiming fees:", error);
      alert("Error claiming fees");
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTabChange = (tab) => {
    setIsLoading(true);
    setActiveTab(tab);
  };

  useEffect(() => {
    const fetchData = async () => {
      const data = await getUserProfile(address, activeTab === "builds");
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

  const formatTimeLeft = (endTimeBigInt) => {
    const endTime = Number(endTimeBigInt);
    const timeLeft = endTime - currentTime;
    if (timeLeft <= 0) return "Voting ended";
    
    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m left`;
  };

  return (
    <div>
      {/* User info bar above navbar */}
      <UserInfoBar address={address} />

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange("ideas")}
            className={`${
              activeTab === "ideas"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Ideas
          </button>
          <button
            onClick={() => handleTabChange("builds")}
            className={`${
              activeTab === "builds"
                ? "border-orange-500 text-orange-600"
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
                  <h3 className="text-xl font-semibold mb-2">{contest.fees.token0name === "Wrapped Ether" ? contest.fees.token1name : contest.fees.token0name}</h3>
                  <p className="text-gray-800 text-base mb-4">
                    {contest.ideaDescription}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                    <div className="text-sm text-gray-500 mb-4 sm:mb-0">
                      {formatTimeLeft(contest.votingEndTime)}
                    </div>

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
                          onClick={async (e) => {
                            e.preventDefault();
                            if (currentTime <= contest.votingEndTime) {
                              alert(`Voting still active. Please wait ${formatTimeLeft(contest.votingEndTime)}`);
                            } else {
                              await handleClaimFees(contest.id);
                            }
                          }}
                          disabled={isPending}
                          className={`w-full sm:w-auto ${
                            currentTime <= contest.votingEndTime 
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-orange-600 hover:bg-orange-700"
                          } text-white px-5 py-2.5 rounded-lg text-sm font-medium transition`}
                        >
                          {currentTime <= contest.votingEndTime ? "Voting Active" : isPending ? "Claiming..." : "Claim Fees"}
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-sm text-gray-500 border border-gray-300 bg-white rounded-md p-3 text-center italic">
                        {currentTime <= contest.votingEndTime ? "Fees not available yet" : "No fees generated"}
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
                  <button
                    onClick={async () => await sdk.actions.openUrl(contest.build.buildLink)}
                    className="inline-flex items-center text-orange-600 hover:text-orange-800 font-medium text-sm"
                  >
                    View Build <ExternalLink size={14} className="ml-1" />
                  </button>

                  <Link
                    href={`/idea/${contest.id}`}
                    className="inline-flex items-center text-orange-600 hover:text-orange-800 font-medium text-sm"
                  >
                    View Idea <ExternalLink size={14} className="ml-1" />
                  </Link>

                  <p className="text-sm text-gray-500">
                    {(Number(contest.build?.voteCount || 0n) / 1e18).toFixed(5)} votes
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-4">
                <div className="text-sm text-gray-500 mb-4 sm:mb-0">
                  {formatTimeLeft(contest.votingEndTime)}
                </div>

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
                      onClick={async (e) => {
                        e.preventDefault();
                        if (currentTime <= contest.votingEndTime) {
                          alert(`Voting still active. Please wait ${formatTimeLeft(contest.votingEndTime)}`);
                        } else {
                          await handleClaimFees(contest.id);
                        }
                      }}
                      className={`w-full sm:w-auto ${
                        currentTime <= contest.votingEndTime 
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-orange-600 hover:bg-orange-700"
                      } text-white px-5 py-2.5 rounded-lg text-sm font-medium transition`}
                    >
                      {currentTime <= contest.votingEndTime ? "Voting Active" : "Claim Fees"}
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
