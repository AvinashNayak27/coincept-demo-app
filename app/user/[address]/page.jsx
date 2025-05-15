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
import { useProofStorage } from "../../../lib/proofStorage";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import QRCode from "react-qr-code";

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

function UserInfoBar({ address }) {
  const [farcasterUsername, setFarcasterUsername] = useState(null);
  const [fid, setFid] = useState(null);
  const [requestUrl, setRequestUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [devfolioLinked, setDevfolioLinked] = useState(false);
  const [devfolioUsername, setDevfolioUsername] = useState(null);

  const { proofs, username, statusUrl, saveProofs, clearProofs, fetchProofs } =
    useProofStorage();

  // Determine device type for Reclaim SDK
  const getDeviceType = () => {
    if (typeof window === "undefined") return "desktop";
    const isMobileDevice =
      /android|linux aarch64|linux armv|iphone|ipad|ipod/i.test(
        window.navigator.platform
      );
    const isAppleDevice = /mac|iphone|ipad|ipod/i.test(
      window.navigator.platform
    );
    return isMobileDevice ? (isAppleDevice ? "ios" : "android") : "desktop";
  };

  // Helper: Save devfolio username to localStorage
  const saveDevfolioToLocalStorage = (address, username) => {
    if (typeof window === "undefined") return;
    try {
      const key = `devfolio:${address.toLowerCase()}`;
      window.localStorage.setItem(key, username);
    } catch (e) {}
  };

  // Helper: Get devfolio username from localStorage
  const getDevfolioFromLocalStorage = (address) => {
    if (typeof window === "undefined") return null;
    try {
      const key = `devfolio:${address.toLowerCase()}`;
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };

  // Helper: Extract devfolio username from proofs
  const extractDevfolioUsernameFromProofs = (proofs, fallbackUsername) => {
    let extractedUsername = JSON.parse(proofs.claimData.parameters).paramValues
      .username;

    if (!extractedUsername && fallbackUsername) {
      extractedUsername = fallbackUsername;
    }
    if (!extractedUsername) {
      extractedUsername = "devfolio-user";
    }
    return extractedUsername;
  };

  // Modified verification request to store devfolio username in localStorage on success
  const getVerificationReq = async () => {
    setIsLoading(true);
    try {
      const APP_ID = "0x886e0d3B4F3DA7bE7e79A05979003030E6f4Efbc";
      const APP_SECRET =
        "0x25adf229b3cfd0a5fc79a7fc401a881e1ad80c95185d9bf5d00a34dd9965ef5e";
      const PROVIDER_ID = "434b4f1f-f46b-46d8-8f69-63af765b0ddf";

      const deviceType = getDeviceType();

      const reclaimProofRequest = await ReclaimProofRequest.init(
        APP_ID,
        APP_SECRET,
        PROVIDER_ID,
        {
          device: deviceType,
          useAppClip: "desktop" !== deviceType,
        }
      );

      // if (deviceType !== "desktop") {
      //   reclaimProofRequest.setRedirectUrl(
      //     "https://warpcast.com/~/frames/launch?domain=coincept.world"
      //   );
      // }

      const url = await reclaimProofRequest.getRequestUrl();
      setRequestUrl(url);

      const statusUrl = await reclaimProofRequest.getStatusUrl();
      saveProofs([], statusUrl);

      await reclaimProofRequest.startSession({
        onSuccess: (newProofs) => {
          // Try to extract devfolio username from proofs
          const extractedUsername = extractDevfolioUsernameFromProofs(
            newProofs,
            username
          );
          // Save to localStorage
          saveDevfolioToLocalStorage(address, extractedUsername);
          setDevfolioUsername(extractedUsername);
          setDevfolioLinked(true);

          console.log("Verification success", newProofs);
          saveProofs(newProofs, statusUrl);
          setIsLoading(false);
        },
        onError: (error) => {
          console.error("Verification failed", error);
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error("Error setting up verification:", error);
      setIsLoading(false);
    }
  };

  const handleVerifyAnother = () => {
    clearProofs();
    setDevfolioLinked(false);
    setDevfolioUsername(null);
    getVerificationReq();
  };

  const isIPhoneOrAndroid = () => {
    if (typeof window === "undefined") return false;
    return (
      window.navigator.platform.includes("iPhone") ||
      window.navigator.platform.includes("Linux aarch64")
    );
  };

  // Load devfolio username from proofs (via fetchProofs) as well as localStorage
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

    const tryLoadDevfolioFromProofs = async () => {
      // Try to load proofs from storage (if any)
      let loadedProofs = proofs;
      let loadedStatusUrl = statusUrl;
      // If no proofs but there is a statusUrl, try to fetch them
      if ((!loadedProofs || loadedProofs.length === 0) && loadedStatusUrl) {
        try {
          loadedProofs = await fetchProofs(loadedStatusUrl);
        } catch (e) {
          loadedProofs = [];
        }
      }
      // Try to extract devfolio username from proofs
      const extractedUsername = extractDevfolioUsernameFromProofs(
        loadedProofs,
        username
      );
      if (
        loadedProofs &&
        loadedProofs.length > 0 &&
        extractedUsername &&
        extractedUsername !== "devfolio-user"
      ) {
        saveDevfolioToLocalStorage(address, extractedUsername);
        setDevfolioUsername(extractedUsername);
        setDevfolioLinked(true);
        return true;
      }
      return false;
    };

    if (address) {
      fetchProfile();
      // Check if devfolio username is already in localStorage
      const storedDevfolio = getDevfolioFromLocalStorage(address);
      if (storedDevfolio) {
        setDevfolioUsername(storedDevfolio);
        setDevfolioLinked(true);
      } else {
        // Try to load from proofs (including fetchProofs)
        tryLoadDevfolioFromProofs().then((found) => {
          if (!found) {
            setDevfolioUsername(null);
            setDevfolioLinked(false);
            getVerificationReq(); // Start verification immediately if not linked
          }
        });
      }
    } else {
      setFarcasterUsername(null);
      setFid(null);
      setDevfolioLinked(false);
      setDevfolioUsername(null);
      clearProofs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="font-mono text-gray-700 text-sm break-all">
          <span className="font-semibold text-gray-900">Address:</span>{" "}
          {address.substring(0, 6) +
            "..." +
            address.substring(address.length - 4)}
        </span>

        <span className="font-mono text-gray-700 text-sm break-all">
          <span className="font-semibold text-gray-900">Farcaster:</span>{" "}
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={async () => {
              if (fid) {
                await sdk.actions.viewProfile({ fid });
              } else {
                window.open("https://warpcast.com/", "_blank");
              }
            }}
            disabled={!fid}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: fid ? "pointer" : "not-allowed",
            }}
          >
            {farcasterUsername ? `@${farcasterUsername}` : "Get on Farcaster"}
          </button>
        </span>

        <span className="hidden sm:inline-block mx-3 text-gray-300">|</span>

        <span className="text-sm text-gray-700 flex items-center gap-2">
          <span className="font-semibold text-gray-900">Devfolio:</span>
          {devfolioLinked && devfolioUsername ? (
            <button
              className="text-blue-600 flex items-center hover:underline"
              type="button"
              onClick={async () => {
                const url = `https://devfolio.co/@${devfolioUsername}`;
                await sdk.actions.openUrl(url);
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              @{devfolioUsername}
              <ExternalLink size={14} className="ml-1" />
            </button>
          ) : (
            <>
              {isIPhoneOrAndroid() && requestUrl ? (
                <button
                  onClick={async () => {
                    if (window.navigator.platform.includes("iPhone")) {
                      window.location.href = requestUrl;
                    } else {
                      await sdk.actions.openUrl(requestUrl);
                    }
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-md text-xs font-medium transition disabled:opacity-60 ml-2"
                >
                  Link Devfolio
                </button>
              ) : (
                <button
                  onClick={getVerificationReq}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs font-medium transition duration-200 flex items-center justify-center ml-2"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Processing...</span>
                  ) : (
                    "Link Devfolio"
                  )}
                </button>
              )}
              {/* Show QR code below if not mobile and requestUrl exists */}
              {!isIPhoneOrAndroid() && requestUrl && (
                <div className="flex flex-col items-center space-y-2 ml-4">
                  <div className="p-2 bg-white rounded-lg shadow-inner">
                    <QRCode value={requestUrl} size={120} />
                  </div>
                  <p className="text-xs text-gray-600 text-center">
                    Scan to link your Devfolio profile
                  </p>
                </div>
              )}
            </>
          )}
        </span>
        {/* 
        {proofs && (
          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="text-xl font-semibold text-green-700 mb-2">Verification Successful!</h2>
            <div className="bg-white p-3 rounded overflow-auto max-h-60">
              <pre className="text-xs text-gray-700">{JSON.stringify(proofs, null, 2)}</pre>
            </div>
            {username && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-gray-700">Username: {username}</span>
                <button
                  onClick={handleVerifyAnother}
                  className="text-red-500 hover:text-red-700"
                >
                  Verify Another
                </button>
              </div>
            )}
          </div>
        )} */}
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
                  <h3 className="text-xl font-semibold mb-2">
                    {contest.fees.token0name === "Wrapped Ether"
                      ? contest.fees.token1name
                      : contest.fees.token0name}
                  </h3>
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
                              alert(
                                `Voting still active. Please wait ${formatTimeLeft(
                                  contest.votingEndTime
                                )}`
                              );
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
                          {currentTime <= contest.votingEndTime
                            ? "Voting Active"
                            : isPending
                            ? "Claiming..."
                            : "Claim Fees"}
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-sm text-gray-500 border border-gray-300 bg-white rounded-md p-3 text-center italic">
                        {currentTime <= contest.votingEndTime
                          ? "Fees not available yet"
                          : "No fees generated"}
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
                    onClick={async () =>
                      await sdk.actions.openUrl(contest.build.buildLink)
                    }
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
                    {(Number(contest.build?.voteCount || 0n) / 1e18).toFixed(5)}{" "}
                    votes
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
                          alert(
                            `Voting still active. Please wait ${formatTimeLeft(
                              contest.votingEndTime
                            )}`
                          );
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
                      {currentTime <= contest.votingEndTime
                        ? "Voting Active"
                        : "Claim Fees"}
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
