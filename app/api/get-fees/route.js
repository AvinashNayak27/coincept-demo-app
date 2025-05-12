
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  "https://base-mainnet.g.alchemy.com/v2/VTw-hkd9ryjCAozXE_MLJNRWvr_FM4Ma"
);

const PositionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const UniswapV3FactoryAddress = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

const Q96 = 2n ** 96n;
const MAX_UINT128 = 2n ** 128n - 1n;

const NFTPositionManagerABI = [
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)",
];

const UniswapV3FactoryABI = [
  "function getPool(address token0, address token1, uint24 fee) external view returns (address pool)",
];

const UniswapV3PoolABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
];

const ERC20ABI = ["function decimals() view returns (uint8)", "function name() view returns (string)"];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const nftId = searchParams.get("nftId");
  const blockTag = "latest";

  if (!nftId)
    return new Response(JSON.stringify({ error: "Missing nftId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const positionManager = new ethers.Contract(
      PositionManagerAddress,
      NFTPositionManagerABI,
      provider
    );
    const posData = await positionManager.positions(nftId, { blockTag });
    const nftOwner = await positionManager.ownerOf(nftId, { blockTag });

    const { token0, token1, fee, tickLower, tickUpper, liquidity } = posData;

    const factory = new ethers.Contract(
      UniswapV3FactoryAddress,
      UniswapV3FactoryABI,
      provider
    );
    const poolAddress = await factory.getPool(token0, token1, fee);
    const pool = new ethers.Contract(poolAddress, UniswapV3PoolABI, provider);
    const { sqrtPriceX96 } = await pool.slot0({ blockTag });

    const token0Contract = new ethers.Contract(token0, ERC20ABI, provider);
    const token1Contract = new ethers.Contract(token1, ERC20ABI, provider);
    const [decimals0, decimals1, token0name, token1name] = await Promise.all([
      token0Contract.decimals({ blockTag }),
      token1Contract.decimals({ blockTag }),
      token0Contract.name({ blockTag }),
      token1Contract.name({ blockTag }),
    ]);

    const currentTick = getTickAtSqrtRatio(sqrtPriceX96);
    const tickLowerNum = Number(tickLower);
    const tickUpperNum = Number(tickUpper);
    const currentTickNum = Number(currentTick);

    const sqrtRatioA = Math.sqrt(1.0001 ** tickLowerNum);
    const sqrtRatioB = Math.sqrt(1.0001 ** tickUpperNum);
    const currentRatio = Math.sqrt(1.0001 ** currentTickNum);

    let amount0wei = 0;
    let amount1wei = 0;

    if (currentTickNum <= tickLowerNum) {
      amount0wei = Math.floor(
        Number(liquidity) *
          ((sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB))
      );
    } else if (currentTickNum > tickUpperNum) {
      amount1wei = Math.floor(Number(liquidity) * (sqrtRatioB - sqrtRatioA));
    } else {
      amount0wei = Math.floor(
        Number(liquidity) *
          ((sqrtRatioB - currentRatio) / (currentRatio * sqrtRatioB))
      );
      amount1wei = Math.floor(Number(liquidity) * (currentRatio - sqrtRatioA));
    }

    const decimals0Num = Number(decimals0);
    const decimals1Num = Number(decimals1);
    const amount0 = amount0wei / 10 ** decimals0Num;
    const amount1 = amount1wei / 10 ** decimals1Num;

    const { amount0: fee0, amount1: fee1 } =
      await positionManager.collect.staticCall(
        {
          tokenId: nftId,
          recipient: nftOwner,
          amount0Max: MAX_UINT128,
          amount1Max: MAX_UINT128,
        },
        { from: nftOwner, blockTag }
      );

    const unclaimedFee0 = parseFloat(ethers.formatUnits(fee0, decimals0));
    const unclaimedFee1 = parseFloat(ethers.formatUnits(fee1, decimals1));

    // Calculate fee splits
    const clankerFee0 = unclaimedFee0 * 0.2;
    const coinceptFee0 = unclaimedFee0 * 0.2;
    const builderFee0 = unclaimedFee0 * 0.54;
    const ideaCuratorFee0 = unclaimedFee0 * 0.06;

    const clankerFee1 = unclaimedFee1 * 0.2;
    const coinceptFee1 = unclaimedFee1 * 0.2;
    const builderFee1 = unclaimedFee1 * 0.54;
    const ideaCuratorFee1 = unclaimedFee1 * 0.06;

    return new Response(
      JSON.stringify({
        token0,
        token1,
        token0name,
        token1name,
        clanker: {
          fee0: clankerFee0,
          fee1: clankerFee1,
        },
        coincept: {
          fee0: coinceptFee0,
          fee1: coinceptFee1,
        },
        builder: {
          fee0: builderFee0,
          fee1: builderFee1,
        },
        ideaCurator: {
          fee0: ideaCuratorFee0,
          fee1: ideaCuratorFee1,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to get unclaimed fees",
        details: err.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

function getTickAtSqrtRatio(sqrtPriceX96) {
  const sqrt = Number(sqrtPriceX96) / Number(Q96);
  const tick = Math.floor(Math.log(sqrt ** 2) / Math.log(1.0001));
  return tick;
}