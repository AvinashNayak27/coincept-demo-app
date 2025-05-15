"use client";
import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { X } from "lucide-react";
import { config } from "../lib/providers";
import { coincept_address, coincept_abi, erc20abi } from "../lib/constants";
import { readContract } from "@wagmi/core";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWriteContract } from "wagmi";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import { getBalance } from "@wagmi/core";
import { sdk } from "@farcaster/frame-sdk";
import blockies from "ethereum-blockies";

const getCastDetails = async (castId) => {
  const options = {
    method: "GET",
    headers: {
      "x-api-key": "2216F242-CC39-4709-95D7-ECD0FA514263",
      "x-neynar-experimental": "false",
    },
  };

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?type=hash&identifier=${castId}`,
      options
    );
    const data = await response.json();
    return data;
  } catch (err) {
    console.error(err);
  }
};

export const getProfile = async (address) => {
  const options = {
    method: "GET",
    headers: {
      "x-api-key": "2216F242-CC39-4709-95D7-ECD0FA514263",
      "x-neynar-experimental": "false",
    },
  };

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
      options
    );
    const data = await response.json();
    console.log(data);
    return data;
  } catch (err) {
    console.error(err);
  }
};

const WarpcastEmbed = ({ cast, votingStartTime, votingEndTime }) => {
  if (!cast) return null;
  const author = cast.author;
  const text = cast.text;
  const timestamp = new Date(cast.timestamp).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const now = Date.now() / 1000;
  let votingStatus;
  if (now < Number(votingStartTime)) {
    const timeToStart = Number(votingStartTime) - now;
    const days = Math.floor(timeToStart / (60 * 60 * 24));
    const hours = Math.floor((timeToStart % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((timeToStart % (60 * 60)) / 60);
    votingStatus = `Starts in ${days} days ${hours} hours ${minutes} mins`;
  } else if (now > Number(votingEndTime)) {
    votingStatus = "Voting ended";
  } else {
    const timeLeft = Number(votingEndTime) - now;
    const days = Math.floor(timeLeft / (60 * 60 * 24));
    const hours = Math.floor((timeLeft % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
    votingStatus = `${days} days ${hours} hours ${minutes} mins left`;
  }

  return (
    <div className="max-w-md rounded-xl overflow-hidden mt-4 bg-white text-sm font-sans">
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <img
            src={author.pfp_url}
            alt={author.username}
            className="w-10 h-10 rounded-full object-cover cursor-pointer"
            onClick={async () => {
              await sdk.actions.viewProfile({
                fid: author.fid,
              });
            }}
          />
          <div>
            <div className="font-semibold">{author.display_name}</div>
            <div className="text-gray-500 text-xs">@{author.username}</div>
          </div>
          <div className="ml-auto">
            <div
              className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-gray-500 font-bold cursor-pointer"
              onClick={async () => {
                await sdk.actions.openUrl(
                  `https://warpcast.com/${
                    author.username
                  }/${cast.hash.substring(0, 10)}`
                );
              }}
            >
              w
            </div>
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-snug">{text}</p>
        <div className="text-gray-400 text-xs mt-2">
          {timestamp.split(",")[1].trim()} • {timestamp.split(",")[0]}
        </div>
      </div>
      <div className="bg-orange-50 px-4 py-2 text-orange-600 font-semibold text-sm rounded-b-xl">
        {votingStatus}
      </div>
    </div>
  );
};

export const ProfileCard = ({ address }) => {
  const [profile, setProfile] = useState(null);

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
          setProfile(profiles[addressFromProfile][0]);
        } else {
          setProfile(null);
        }
      } catch (e) {
        setProfile(null);
      }
    };
    if (address) {
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [address]);

  if (!profile || !profile.display_name) {
    // Avoid ReferenceError: document is not defined (SSR)
    if (typeof window === "undefined") {
      // On server, render a placeholder (e.g. empty avatar)
      return (
        <div
          className="w-8 h-8 rounded-full bg-gray-200"
          style={{ display: "inline-block" }}
        />
      );
    }

    const blockiesIcon = blockies.create({ seed: address.toLowerCase() }).toDataURL();

    return (
      <img
        src={blockiesIcon}
        className="w-8 h-8 rounded-full"
        onClick={() => {
          window.location.href = `/user/${address}`;
        }}
      />
    );
  }

  return (
    <img
      src={profile.pfp_url}
      alt={profile.display_name}
      className="w-8 h-8 rounded-full"
      onClick={() => {
        window.location.href = `/user/${address}`;
      }}
    />
  );
};

const getUserBalance = async (address, token) => {
  console.log("Getting balance for:", address, token);
  const balance = await getBalance(config, { address: address, token: token });
  return Number(balance.value) / 10 ** balance.decimals;
};

const encodePath = (tokenIn, tokenOut, fee) => {
  return ethers.solidityPacked(
    ["address", "uint24", "address"],
    [tokenIn, fee, tokenOut]
  );
};

const getQuote = async (token1, amountIn) => {
  try {
    const provider = new ethers.JsonRpcProvider(
      "https://base-mainnet.g.alchemy.com/v2/rgLw9ASxDjV4MABUX8q3jYH8rQg1vYTj"
    );
    const quoterContract = new ethers.Contract(
      "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
      [
        {
          inputs: [
            {
              internalType: "address",
              name: "_factory",
              type: "address",
            },
            {
              internalType: "address",
              name: "_WETH9",
              type: "address",
            },
          ],
          stateMutability: "nonpayable",
          type: "constructor",
        },
        {
          inputs: [],
          name: "WETH9",
          outputs: [
            {
              internalType: "address",
              name: "",
              type: "address",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [],
          name: "factory",
          outputs: [
            {
              internalType: "address",
              name: "",
              type: "address",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "bytes",
              name: "path",
              type: "bytes",
            },
            {
              internalType: "uint256",
              name: "amountIn",
              type: "uint256",
            },
          ],
          name: "quoteExactInput",
          outputs: [
            {
              internalType: "uint256",
              name: "amountOut",
              type: "uint256",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "tokenIn",
              type: "address",
            },
            {
              internalType: "address",
              name: "tokenOut",
              type: "address",
            },
            {
              internalType: "uint24",
              name: "fee",
              type: "uint24",
            },
            {
              internalType: "uint256",
              name: "amountIn",
              type: "uint256",
            },
            {
              internalType: "uint160",
              name: "sqrtPriceLimitX96",
              type: "uint160",
            },
          ],
          name: "quoteExactInputSingle",
          outputs: [
            {
              internalType: "uint256",
              name: "amountOut",
              type: "uint256",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "bytes",
              name: "path",
              type: "bytes",
            },
            {
              internalType: "uint256",
              name: "amountOut",
              type: "uint256",
            },
          ],
          name: "quoteExactOutput",
          outputs: [
            {
              internalType: "uint256",
              name: "amountIn",
              type: "uint256",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "tokenIn",
              type: "address",
            },
            {
              internalType: "address",
              name: "tokenOut",
              type: "address",
            },
            {
              internalType: "uint24",
              name: "fee",
              type: "uint24",
            },
            {
              internalType: "uint256",
              name: "amountOut",
              type: "uint256",
            },
            {
              internalType: "uint160",
              name: "sqrtPriceLimitX96",
              type: "uint160",
            },
          ],
          name: "quoteExactOutputSingle",
          outputs: [
            {
              internalType: "uint256",
              name: "amountIn",
              type: "uint256",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "int256",
              name: "amount0Delta",
              type: "int256",
            },
            {
              internalType: "int256",
              name: "amount1Delta",
              type: "int256",
            },
            {
              internalType: "bytes",
              name: "path",
              type: "bytes",
            },
          ],
          name: "uniswapV3SwapCallback",
          outputs: [],
          stateMutability: "view",
          type: "function",
        },
      ],
      provider
    );

    const amountInWei = ethers.parseUnits(amountIn.toFixed(18), 18);
    const token0 = "0x4200000000000000000000000000000000000006";
    const fee = 10000;

    const path = encodePath(token0, token1, fee);
    const quotedAmountOut = await quoterContract.quoteExactInput.staticCall(
      path,
      amountInWei
    );
    return quotedAmountOut;
  } catch (err) {
    console.error("Quote error:", err);
    return "0";
  }
};

const createSwapCalldata = async (token1, amountIn, address) => {
  try {
    const provider = new ethers.JsonRpcProvider(
      "https://base-mainnet.g.alchemy.com/v2/rgLw9ASxDjV4MABUX8q3jYH8rQg1vYTj"
    );
    const ROUTER_ABI = [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
      "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
    ];
    const router = new ethers.Contract(
      "0x2626664c2603336E57B271c5C0b26F421741e481",
      ROUTER_ABI,
      provider
    );
    const amountInWei = ethers.parseUnits(amountIn.toFixed(18), 18);

    const params = {
      tokenIn: "0x4200000000000000000000000000000000000006",
      tokenOut: token1,
      fee: 10000,
      recipient: address,
      amountIn: amountInWei,
      amountOutMinimum: 0, // Add slippage calculation here if needed
      sqrtPriceLimitX96: 0,
    };

    const calldata = router.interface.encodeFunctionData("exactInputSingle", [
      params,
    ]);

    return {
      calldata,
      value: amountInWei.toString(),
      expectedOutput: "0",
      minOutput: "0",
    };
  } catch (err) {
    console.error("Swap error:", err);
    throw err;
  }
};

const getVotingPower = async (address, tokenAddress) => {
  const votingPower = await readContract(config, {
    abi: erc20abi,
    address: tokenAddress,
    functionName: "getVotes",
    args: [address],
  });
  return votingPower;
};
const hasUserVoted = async (address, contestId) => {
  const VotingInfo = await readContract(config, {
    abi: coincept_abi,
    address: coincept_address,
    functionName: "getVotingInfo",
    args: [contestId, address],
  });

  const hasVoted = VotingInfo.votingPower > 0;
  return hasVoted;
};
const getDelegate = async (address, tokenAddress) => {
  return await readContract(config, {
    abi: erc20abi,
    address: tokenAddress,
    functionName: "delegates",
    args: [address],
  });
};

const BuildCard = ({
  build,
  displayVotes,
  voteToken,
  contestId,
  buildId,
  refresh,
}) => {
  const [ogData, setOgData] = useState({});
  const { address } = useAccount();
  const [votingPower, setVotingPower] = useState(0);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [voteStep, setVoteStep] = useState(1); // 1: check power/delegate, 2: confirm vote
  const [isDelegating, setIsDelegating] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentDelegate, setCurrentDelegate] = useState("");
  const [currentVotingPower, setCurrentVotingPower] = useState(0);
  const [delegateErrorMsg, setDelegateErrorMsg] = useState("");
  const [voteErrorMsg, setVoteErrorMsg] = useState("");
  const [voteSuccess, setVoteSuccess] = useState(false); // NEW: track vote success
  const [refreshBuild, setRefreshBuild] = useState(0); // NEW: trigger build refresh
  const {
    data: delegateHash,
    isPending: delegatePending,
    writeContractAsync: delegateWriteContract,
    error: delegateError,
    isSuccess: delegateSuccess,
  } = useWriteContract();
  const {
    data: voteHash,
    isPending: votePending,
    writeContractAsync: voteWriteContract,
    error: voteError,
    isSuccess: voteIsSuccess,
  } = useWriteContract();

  const [userBalance, setUserBalance] = useState(0);

  const getUsername = async (address) => {
    const profiles = await getProfile(address);
    if (!profiles || Object.keys(profiles).length === 0) {
      return "";
    }
    const addressFromProfile = Object.keys(profiles)[0];
    const profile = profiles[addressFromProfile][0];
    return (
      profile?.username ||
      address.substring(0, 6) + "..." + address.substring(38)
    );
  };

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const username = await getUsername(build.author);
        setUsername(username);
      } catch (error) {
        console.error("Error fetching username:", error);
        setUsername("");
      }
    };
    fetchUsername();
  }, [build.author]);

  useEffect(() => {
    const fetchVotingPower = async () => {
      if (address && voteToken) {
        try {
          const power = await getVotingPower(address, voteToken);
          const Voted = await hasUserVoted(address, contestId);
          setHasVoted(Voted);
          if (!Voted) {
            setVotingPower(Number(power) / 1e18);
          } else {
            setVotingPower(0);
          }
        } catch (error) {
          console.error("Error fetching voting power:", error);
          setVotingPower(0);
        }
      }
    };

    fetchVotingPower();
  }, [address, voteToken, delegateHash, voteHash, refresh, refreshBuild]);

  // Split handleVote into two steps: open modal, then check power/delegate
  const openVoteModal = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }
    setDelegateErrorMsg("");
    setVoteErrorMsg("");
    setShowVoteModal(true);

    // Fetch current voting power and delegate
    try {
      const balance = await getUserBalance(address, voteToken);
      setUserBalance(balance);
      const votingPower = await getVotingPower(address, voteToken);
      const delegate = await getDelegate(address, voteToken);
      console.log(votingPower, delegate);
      setCurrentVotingPower(Number(votingPower) / 1e18);
      setCurrentDelegate(delegate);
      if (balance <= 0) {
        setVoteStep(1);
        return;
      }

      // If voting power > 0 and delegated to self, go directly to step 2
      if (
        Number(votingPower) / 1e18 > 0 &&
        delegate.toLowerCase() === address.toLowerCase()
      ) {
        setVoteStep(2);
      } else {
        setVoteStep(1);
      }
    } catch (error) {
      setDelegateErrorMsg("Error fetching voting power or delegate.");
      setVoteStep(1);
    }
  };

  // Step 1: Delegate to self if needed
  const handleDelegateToSelf = async () => {
    setIsDelegating(true);
    setDelegateErrorMsg("");
    try {
      await delegateWriteContract({
        address: voteToken,
        abi: erc20abi,
        functionName: "delegate",
        args: [address],
      });
      // No need for setTimeout, refetch on delegate success below
    } catch (error) {
      setDelegateErrorMsg("Error delegating. Please try again.");
      setIsDelegating(false);
    }
  };

  // Refetch voting power and delegate when delegate is successful
  useEffect(() => {
    const refetchVotingPowerAndDelegate = async () => {
      if (delegateSuccess && address && voteToken) {
        try {
          const votingPower = await getVotingPower(address, voteToken);
          const delegate = await getDelegate(address, voteToken);
          console.log(votingPower, delegate);
          setCurrentVotingPower(Number(votingPower) / 1e18);
          setCurrentDelegate(delegate);
          setIsDelegating(false);
          // If voting power > 0 and delegated to self, go directly to step 2
          if (
            Number(votingPower) / 1e18 > 0 &&
            delegate.toLowerCase() === address.toLowerCase()
          ) {
            setVoteStep(2);
          } else {
            setVoteStep(1);
          }
        } catch (error) {
          setDelegateErrorMsg("Error fetching voting power or delegate.");
          setIsDelegating(false);
          setVoteStep(1);
        }
      }
    };
    refetchVotingPowerAndDelegate();
    // Only run when delegateSuccess, address, or voteToken changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegateSuccess, address, voteToken]);

  // Step 2: Confirm vote
  const handleVoteConfirm = async () => {
    setIsVoting(true);
    setVoteErrorMsg("");
    try {
      if (currentDelegate.toLowerCase() !== address.toLowerCase()) {
        setVoteErrorMsg("You must delegate voting power to yourself to vote.");
        setVoteStep(1);
        setIsVoting(false);
        return;
      }
      if (currentVotingPower <= 0) {
        setVoteErrorMsg(
          "You have no voting power. Delegate to yourself to vote."
        );
        setVoteStep(1);
        setIsVoting(false);
        return;
      }
      await voteWriteContract({
        address: coincept_address,
        abi: coincept_abi,
        functionName: "vote",
        args: [Number(contestId), buildId],
      });
      setShowVoteModal(false);
      setIsVoting(false);
      setVoteSuccess(true); // Set vote success to true
    } catch (error) {
      setVoteErrorMsg("Error voting. Please try again.");
      setIsVoting(false);
    }
  };

  // Show alert and refetch vote count on vote success
  useEffect(() => {
    if (voteSuccess) {
      alert("Voting success!");
      window.location.reload();
      // Refetch build data to update vote count
      setRefreshBuild((prev) => prev + 1);
      setVoteSuccess(false);
    }
  }, [voteSuccess]);

  useEffect(() => {
    if (delegateError) {
      setDelegateErrorMsg("Error delegating. Please try again.");
      setIsDelegating(false);
    }
    if (voteError) {
      setVoteErrorMsg("Error voting. Please try again.");
      setIsVoting(false);
    }
  }, [delegateError, voteError]);

  useEffect(() => {
    const fetchOGData = async () => {
      if (build.buildLink) {
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
          setIsLoading(false);
        } catch (error) {
          console.error("Error fetching OpenGraph data:", error);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    fetchOGData();
  }, [build.buildLink]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl overflow-hidden flex items-center justify-between p-4 shadow-sm w-full max-w-md animate-pulse">
        <div className="flex flex-col flex-1">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-200 rounded"></div>
          {displayVotes && (
            <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden flex flex-col shadow-sm w-full max-w-md">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-base font-semibold text-gray-900">
              {build.title || ogData.title}
            </h3>
            <p className="text-sm text-gray-500">@{username}</p>
          </div>

          <div className="flex items-center gap-2">
            {build.buildLink && (
              <button
                onClick={async () => await sdk.actions.openUrl(build.buildLink)}
                className="text-gray-400 hover:text-gray-600"
                title="Open Build Link"
              >
                <ExternalLink size={16} />
              </button>
            )}

            {displayVotes && (
              <div
                onClick={openVoteModal}
                className="bg-green-500 text-white text-sm font-medium px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-green-600"
              >
                <span>Vote</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {displayVotes && (
        <div className="bg-orange-50 px-4 py-2 text-orange-600 font-semibold text-sm">
          {(Number(build.voteCount) / 1e18).toFixed(0)} votes
        </div>
      )}

      {/* Redesigned Vote Modal */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white p-6 rounded-t-xl shadow-xl transform transition-transform duration-300 z-50 ${
          showVoteModal ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ pointerEvents: showVoteModal ? "auto" : "none" }}
      >
        <div className="relative max-w-md mx-auto">
          <button
            onClick={() => setShowVoteModal(false)}
            className="absolute top-0 right-0 text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
          <h3 className="text-xl font-semibold mb-6 text-gray-900 text-center">
            {voteStep === 1 ? "Check Voting Power" : "Confirm Your Vote"}
          </h3>
          {voteStep === 1 && (
            <div>
              <div className="mb-4 bg-gray-50 p-4 rounded-xl">
                <div className="mb-2">
                  <span className="font-semibold">Your Voting Power:</span>{" "}
                  {currentVotingPower}
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Delegated To:</span>{" "}
                  <span className="break-all">
                    {currentDelegate.toLowerCase() ===
                    (address || "").toLowerCase()
                      ? "self"
                      : currentDelegate.substring(0, 6) +
                        "..." +
                        currentDelegate.substring(38)}
                  </span>
                </div>
              </div>
              {delegateErrorMsg && (
                <div className="mb-2 text-red-500 text-sm">
                  {delegateErrorMsg}
                </div>
              )}
              {currentVotingPower <= 0 ||
              currentDelegate.toLowerCase() !==
                (address || "").toLowerCase() ? (
                <button
                  onClick={handleDelegateToSelf}
                  className={`w-full py-3 rounded-lg font-medium transition-all ${
                    userBalance <= 0
                      ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                  disabled={isDelegating || userBalance <= 0}
                >
                  {isDelegating
                    ? "Delegating..."
                    : userBalance > 0
                    ? "Delegate to Myself"
                    : "Not enough tokens"}
                </button>
              ) : (
                <button
                  onClick={() => setVoteStep(2)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-all"
                >
                  Continue to Vote
                </button>
              )}
            </div>
          )}
          {voteStep === 2 && (
            <div>
              <div className="mb-4 bg-gray-50 p-4 rounded-xl">
                <div className="mb-2">
                  <span className="font-semibold">Your Voting Power:</span>{" "}
                  {currentVotingPower}
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Voting To:</span>{" "}
                  <span className="break-all">
                    {ogData.title || `${buildId} th Build`}
                  </span>
                </div>
              </div>
              {voteErrorMsg && (
                <div className="mb-2 text-red-500 text-sm">{voteErrorMsg}</div>
              )}
              <button
                onClick={handleVoteConfirm}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-all"
                disabled={isVoting}
              >
                {isVoting ? "Voting..." : "Vote"}
              </button>
            </div>
          )}
        </div>
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

  const cast = await getCastDetails(metadata.castHash);

  return {
    // @ts-ignore
    ...metadata,
    tokenName,
    tokenSymbol,
    cast,
  };
};

const IdeaPage = ({ id }) => {
  const [ethAmount, setEthAmount] = useState("0.001");
  const [tokenAmount, setTokenAmount] = useState("");
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [buildLink, setBuildLink] = useState("");
  const [idea, setIdea] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [votingActive, setVotingActive] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { address } = useAccount();
  const [userBalance, setUserBalance] = useState(0);

  const [swapping, setSwapping] = useState(false);
  const [swappingHash, setSwappingHash] = useState(null);

  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const devfolioUsername = localStorage.getItem(`devfolio:${address?.toLowerCase()}`);
    const fetchProjects = async () => {
      if (devfolioUsername) {
        try {
          const res = await fetch(`/api/devfolio/${devfolioUsername}?page=1&limit=5`);
          const data = await res.json();
          setProjects(data.result || []);
        } catch (error) {
          console.error("Error fetching projects:", error);
        }
      }
    };

    fetchProjects();
  }, [showSubmitModal,address]);

  useEffect(() => {
    const init = async () => {
      await sdk.actions.ready();
    };
    init();
  }, []);

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
  }, [showBuyModal, showSubmitModal, hash]);

  useEffect(() => {
    if (address && idea) {
      getUserBalance(address, idea.voteToken).then((balance) => {
        console.log("User balance:", balance);
        setUserBalance(balance);
      });
    }
  }, [address, idea, showBuyModal]);

  useEffect(() => {
    if (showBuyModal && idea) {
      handleEthInput("0.001");
    }
  }, [showBuyModal]);

  const handleSubmitBuild = async (link) => {
    try {
      console.log("Submitting build link:", link);

      writeContract({
        address: coincept_address,
        abi: coincept_abi,
        functionName: "submitBuild",
        args: [Number(id), link],
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
  const handleEthInput = async (value) => {
    setEthAmount(value);
    setIsQuoting(true);
    try {
      const quote = await getQuote(idea.voteToken, Number(value));
      setTokenAmount(ethers.formatUnits(quote, 18));
    } catch (error) {
      console.error("Error getting quote:", error);
      setTokenAmount("0");
    }
    setIsQuoting(false);
  };

  return (
    <>
      <div className="pt-4  bg-gray-50 min-h-screen pb-20">
        <div
          style={{
            display: "none",
          }}
        >
          <ConnectButton />
        </div>
        <div className="max-w-4xl mx-auto flex justify-between items-center mb-4 px-4">
          <Link
            href="/ideas"
            className="inline-flex items-center text-indigo-600 hover:underline mb-2 mt-2"
          >
            <ArrowLeft size={16} className="mr-1" />
          </Link>
          {address ? <ProfileCard address={address} /> : <ConnectButton />}
        </div>
        <div className="container mx-auto px-4">
          {/* Back Link */}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Idea Details */}
            <div className="lg:col-span-2">
              <div className="overflow-hidden">
                {idea.voteToken && (
                  <>
                    <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                      <div className="flex items-start justify-between mb-6 w-full">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl font-bold text-gray-900">
                              {idea.tokenName}
                            </span>
                            <span className="text-lg font-semibold text-gray-400">
                              ${idea.tokenSymbol}
                            </span>
                          </div>
                          {/* <div className="flex items-center gap-3 mb-1">
                            <span className="text-3xl font-extrabold text-black">
                              $0.0023
                            </span>
                          </div> */}
                          <div className="text-gray-400 text-base font-medium">
                            Balance: {userBalance.toFixed(5)}
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-90 overflow-hidden rounded-lg">
                        <iframe
                          src={`https://www.geckoterminal.com/base/pools/${idea.voteToken}?embed=1&grayscale=0&info=0&light_chart=0&swaps=0`}
                          title={idea.title}
                          className="w-full h-full border-0"
                        />
                      </div>
                    </div>
                  </>
                )}

                <WarpcastEmbed
                  cast={idea.cast.cast}
                  votingStartTime={idea.votingStartTime}
                  votingEndTime={idea.votingEndTime}
                  className="mt-2"
                />

                {/* Builds Section */}
                <div className="mt-8">
                  <div className="flex gap-4 mb-6">
                    <button
                      onClick={() => setShowBuyModal(true)}
                      className="flex-1 bg-white border-2 border-orange-500 text-orange-500 hover:bg-orange-50 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap"
                    >
                      Buy ${idea.tokenSymbol}
                    </button>
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      className="flex-1 bg-orange-500 text-white hover:bg-orange-600 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap"
                    >
                      Submit Build
                    </button>
                  </div>

                  {idea.builds.length > 0 ? (
                    <>
                      <h2 className="text-xl font-semibold mb-6 text-gray-900">
                        Contributions
                      </h2>
                      <div className="space-y-4">
                        {idea.builds
                          .slice() // copy to avoid mutating original
                          .sort(
                            (a, b) => Number(b.voteCount) - Number(a.voteCount)
                          )
                          .map((build, index) => (
                            <BuildCard
                              key={`${build.buildLink}-${index}`}
                              build={build}
                              displayVotes={votingActive}
                              contestId={id}
                              voteToken={idea.voteToken}
                              buildId={index}
                              refresh={showBuyModal}
                            />
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-xl p-8 text-center">
                      <p className="text-gray-600 mb-4">
                        No builds have been submitted for this idea yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buy Modal */}
        <div
          className={`fixed bottom-0 left-0 right-0 bg-white p-6 rounded-t-xl shadow-xl transform transition-transform duration-300 ${
            showBuyModal ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="relative max-w-md mx-auto">
            <button
              onClick={() => setShowBuyModal(false)}
              className="absolute top-0 right-0 text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>

            <h3 className="text-xl font-semibold mb-6 text-gray-900 text-center">
              Buy {idea.tokenSymbol}
            </h3>

            <div className="bg-gray-50 p-4 rounded-xl mb-4">
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                You Pay
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  value={ethAmount}
                  onChange={(e) => handleEthInput(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-transparent text-2xl font-medium text-gray-900 focus:outline-none"
                />
                <div className="flex items-center bg-white px-3 py-1 rounded-full">
                  <span className="font-medium text-gray-900">ETH</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <button
                onClick={() => handleEthInput("0.001")}
                className="p-2 rounded-lg border border-gray-200 hover:border-indigo-600 text-center transition-all"
              >
                <span className="text-sm font-medium text-gray-900">0.001</span>
              </button>
              <button
                onClick={() => handleEthInput("0.01")}
                className="p-2 rounded-lg border border-gray-200 hover:border-indigo-600 text-center transition-all"
              >
                <span className="text-sm font-medium text-gray-900">0.01</span>
              </button>
              <button
                onClick={() => handleEthInput("0.1")}
                className="p-2 rounded-lg border border-gray-200 hover:border-indigo-600 text-center transition-all"
              >
                <span className="text-sm font-medium text-gray-900">0.1</span>
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl mb-6">
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                You Receive
              </label>
              <div className="flex items-center">
                {isQuoting ? (
                  <div className="w-full flex justify-center">
                    <Loader2 size={24} className="animate-spin text-gray-600" />
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={tokenAmount}
                      readOnly
                      className="w-full bg-transparent text-2xl font-medium text-gray-900 focus:outline-none"
                      placeholder="0.0"
                    />
                    <div className="flex items-center bg-white px-3 py-1 rounded-full">
                      <span className="font-medium text-gray-900">
                        {idea.tokenSymbol}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={async () => {
                const swapData = await createSwapCalldata(
                  idea.voteToken,
                  Number(ethAmount),
                  address
                );
                setSwapping(true);
                const hash = await sendTransaction(config, {
                  to: "0x2626664c2603336E57B271c5C0b26F421741e481",
                  value: swapData.value,
                  data: swapData.calldata,
                });
                const transactionReceipt = await waitForTransactionReceipt(
                  config,
                  {
                    hash: hash,
                  }
                );
                console.log("Transaction receipt:", transactionReceipt);
                setSwapping(false);
                setSwappingHash(hash);
                setShowBuyModal(false);
                window.location.reload();
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-medium transition-colors"
            >
              {swapping
                ? "Swapping..."
                : swappingHash
                ? "Transaction successful!"
                : "Buy " + idea.tokenSymbol}
            </button>
          </div>
        </div>

        {/* Submit Build Modal */}
        <div
          className={`bg-gray-100 fixed bottom-0 left-0 right-0 p-6 rounded-t-xl shadow-xl transform transition-transform duration-300 ${
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

            <h3 className="text-xl font-semibold mb-4 text-gray-900">
              Submit Build
            </h3>

            {/* Check if voting period has ended */}
            {idea && Number(idea.votingEndTime) < Math.floor(Date.now() / 1000) ? (
              <div className="mb-4 text-gray-600 font-semibold">
                Voting closed. Not accepting builds.
              </div>
            ) : (
              <>
                {projects.length > 0 ? (
                  <div className="mt-6">
                    <div className="space-y-4">
                      {projects.map((project, index) => (
                        <div key={index} className="bg-white p-4 rounded-lg shadow">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900 flex items-center">
                                {project.project.name}
                              </h4>
                            </div>
                            <button
                              onClick={async () => {
                                await handleSubmitBuild(`https://devfolio.co/projects/${project.project.slug}`);
                              }}
                              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full p-1.5 transition-colors flex items-center justify-center"
                              title="Submit this project"
                              style={{ height: '32px', width: '32px' }}
                            >
                              <span className="sr-only">Submit this project</span>
                              <svg
                                width="18"
                                height="18"
                                fill="none"
                                viewBox="0 0 20 20"
                                className="inline-block align-middle"
                              >
                                <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
                                <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{project.project.tagline}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  localStorage.getItem(`devfolio:${address?.toLowerCase()}`) ? (
                    <div className="mb-4 text-gray-600">
                      No Devfolio projects found.
                    </div>
                  ) : (
                    <div className="mb-4 text-gray-600">
                      Please link your Devfolio account in your <a href={`/user/${address}`} className="text-orange-500 underline">profile page</a> to submit a build.
                    </div>
                  )
                )}

                {hash && (
                  <div className="mt-4 text-sm text-green-600 ">
                    Build submitted successfully!
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default IdeaPage;
