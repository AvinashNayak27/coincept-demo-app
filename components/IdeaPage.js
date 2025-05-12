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
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import { getBalance } from "@wagmi/core";
import { sdk } from "@farcaster/frame-sdk";

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

const getProfile = async (address) => {
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
                fid: author.fid
              })
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
                await sdk.actions.openUrl(`https://warpcast.com/${author.username}/${cast.hash.substring(0,10)}`)
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
      const profiles = await getProfile(address);
      const addressFromProfile = Object.keys(profiles)[0];

      const profile = profiles[addressFromProfile][0];
      console.log(profile);

      setProfile(profile);
    };
    fetchProfile();
  }, [address]);

  if (!profile) {
    return <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />;
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
  const {
    data: delegateHash,
    isPending: delegatePending,
    writeContractAsync: delegateWriteContract,
    error: delegateError,
  } = useWriteContract();
  const {
    data: voteHash,
    isPending: votePending,
    writeContractAsync: voteWriteContract,
    error: voteError,
  } = useWriteContract();
  const [hasVoted, setHasVoted] = useState(false);
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const getUsername = async (address) => {
    const profiles = await getProfile(address);
    if (!profiles || Object.keys(profiles).length === 0) {
      return '';
    }
    const addressFromProfile = Object.keys(profiles)[0];
    const profile = profiles[addressFromProfile][0];
    return profile?.username || address.substring(0, 6) + "..." + address.substring(38);
  };

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const username = await getUsername(build.author);
        setUsername(username);
      } catch (error) {
        console.error('Error fetching username:', error);
        setUsername('');
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
  }, [address, voteToken, delegateHash, voteHash, refresh]);

  const handleVote = async () => {
    try {
      if (!address) {
        throw new Error("Please connect your wallet first");
      }

      if (hasVoted) {
        alert("You have already voted");
        return;
      }

      if (votingPower <= 0) {
        await delegateWriteContract({
          address: voteToken,
          abi: erc20abi,
          functionName: "delegate",
          args: [address],
        });
      }

      await voteWriteContract({
        address: coincept_address,
        abi: coincept_abi,
        functionName: "vote",
        args: [Number(contestId), buildId],
      });
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  useEffect(() => {
    if (delegateError || voteError) {
      alert("Error voting, please try again");
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
    <div className="bg-white rounded-xl overflow-hidden flex items-center justify-between p-4 shadow-sm w-full max-w-md">
      <div className="flex flex-col">
        <h3 className="text-base font-semibold text-gray-900">
          {build.title || ogData.title}
        </h3>
        <p className="text-sm text-gray-500">
          @{username}
        </p>
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
            onClick={handleVote}
            className="bg-green-500 text-white text-sm font-medium px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-green-600"
          >
            {(Number(build.voteCount) / 1e18).toFixed(0)}
            <svg width="13" height="7" viewBox="0 0 13 7" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.54058 0.492659C9.18634 1.81739 10.6543 3.36108 11.9062 5.08327C12.0603 5.29253 12.1431 5.5559 12.1218 5.83537C12.0747 6.4549 11.5342 6.9189 10.9147 6.87176C7.97585 6.64811 5.02426 6.64811 2.08542 6.87176C1.46589 6.9189 0.925444 6.4549 0.878297 5.83537C0.85703 5.55591 0.939772 5.29254 1.09388 5.08328C2.34579 3.36108 3.81376 1.81739 5.45953 0.492658C6.06853 0.00244786 6.93158 0.00244638 7.54058 0.492659Z" fill="white"/>
            </svg>
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
  }, [showBuyModal, showSubmitModal,hash]);

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
      <div className="pt-4  bg-gray-50 min-h-screen">
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
              <div className=" overflow-hidden">
                {idea.voteToken && (
                  <>
                    <div className="flex flex-wrap justify-between mb-4 gap-2 flex-col">
                      <h3 className="text-xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-0 flex items-center cursor-pointer" onClick={async () => await sdk.actions.openUrl(`https://www.geckoterminal.com/base/pools/${idea.voteToken}?utm_source=embed`)}>
                        {idea.tokenName}{" "}
                        <span className="text-gray-500 text-sm ml-2 flex items-center mt-1">
                          ${idea.tokenSymbol}
                        </span>
                      </h3>
                      <div className="flex items-center text-gray-600">
                        <span>Balance: {userBalance.toFixed(4)}</span>
                      </div>
                    </div>

                    <div className="w-full h-48 overflow-hidden">
                      <iframe
                        src={`https://www.geckoterminal.com/base/pools/${idea.voteToken}?embed=1&grayscale=0&info=0&light_chart=0&swaps=0`}
                        title={idea.title}
                        className="w-full h-full border-0 rounded-lg"
                      />
                    </div>
                  </>
                )}


                  {/* <div className="flex flex-wrap gap-4 mb-6 text-sm">
                    <div className="flex items-center text-gray-600">
                      <User size={16} className="mr-1" />
                      Creator: {idea.creator.substring(0, 6)}...
                      {idea.creator.substring(38)}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Coins size={16} className="mr-1" />
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(idea.voteToken);
                        }}
                        className="cursor-pointer hover:text-indigo-600"
                      >
                        Token: {idea.tokenSymbol}
                      </span>
                    </div>

                    <div className="flex items-center text-gray-600">
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
                    <h2 className="text-xl font-semibold mb-3 text-gray-900">
                      Description
                    </h2>
                    <p className="text-gray-700 whitespace-pre-line">
                      {idea.ideaDescription}
                    </p>
                  </div> */}
                  <WarpcastEmbed cast={idea.cast.cast} votingStartTime={idea.votingStartTime} votingEndTime={idea.votingEndTime} className="mt-2" />

                  {/* {!votingActive && (
                    <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-4">
                      <p>
                        Voting is{" "}
                        {Date.now() / 1000 < Number(idea.votingStartTime)
                          ? "not yet started,but you can still submit a build"
                          : "already ended"}
                        .
                      </p>
                    </div>
                  )} */}
              </div>

              {/* Builds Section */}
              <div className="mt-4">
                <div className="flex gap-4 mb-4">
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
                  <h2 className="text-xl font-semibold mb-4 text-gray-900">Contributions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {idea.builds.map((build, index) => (
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
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-medium transition-colors"
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
          className={`bg-gray-200 fixed bottom-0 left-0 right-0 p-6 rounded-t-xl shadow-xl transform transition-transform duration-300 ${
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

            <div className="mb-4">
              <input
                type="text"
                value={buildLink}
                onChange={(e) => setBuildLink(e.target.value)}
                placeholder="Enter your Devfolio link"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleSubmitBuild}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-all"
            >
              {isPending ? "Submitting..." : "Submit Build"}
            </button>
            {hash && (
              <div className="mt-4 text-sm text-green-600 ">
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
