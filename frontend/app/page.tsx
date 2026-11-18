"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useWriteContract, useReadContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import {
  STAKE_TOKEN_ADDRESS,
  REWARD_TOKEN_ADDRESS,
  STAKING_POOL_ADDRESS,
  ERC20_ABI,
  STAKING_POOL_ABI,
} from "../abi/contracts";

const STAKE_OPTIONS = [
  { id: 0, title: "Flexible", rate: "10% Base", days: 0 },
  { id: 1, title: "30-Day Lock", rate: "15% Base", days: 30 },
  { id: 2, title: "90-Day Lock", rate: "22% Base", days: 90 },
];

const REWARD_OPTIONS = [
  { id: 0, title: "APR (Simple)", desc: "Linear yield in RWD" },
  { id: 1, title: "APY (Compounded)", desc: "Daily compounding in RWD" },
];

export default function StakingApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync, isPending } = useWriteContract();

  const [amount, setAmount] = useState("100");
  const [stakeMode, setStakeMode] = useState<number>(0);
  const [rewardMode, setRewardMode] = useState<number>(0);
  const [withdrawMode, setWithdrawMode] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const { data: poolTvl, refetch: refetchTvl } = useReadContract({
    address: STAKE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [STAKING_POOL_ADDRESS],
  });

  const { data: rewardReserve, refetch: refetchReserve } = useReadContract({
    address: REWARD_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [STAKING_POOL_ADDRESS],
  });

  const { data: userStkBalance, refetch: refetchUserStk } = useReadContract({
    address: STAKE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: userRwdBalance, refetch: refetchUserRwd } = useReadContract({
    address: REWARD_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: STAKE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, STAKING_POOL_ADDRESS] : undefined,
  });

  const { data: pendingReward, refetch: refetchReward } = useReadContract({
    address: STAKING_POOL_ADDRESS,
    abi: STAKING_POOL_ABI,
    functionName: "calculateReward",
    args: address ? [address] : undefined,
    query: { refetchInterval: 3000 },
  });

  const { data: position, refetch: refetchPosition } = useReadContract({
    address: STAKING_POOL_ADDRESS,
    abi: STAKING_POOL_ABI,
    functionName: "positions",
    args: address ? [address] : undefined,
  });

  const refreshAll = () => {
    refetchTvl();
    refetchReserve();
    refetchUserStk();
    refetchUserRwd();
    refetchAllowance();
    refetchPosition();
    refetchReward();
  };

  const parsedAmount = Number(amount) > 0 ? parseEther(amount) : BigInt(0);
  const hasEnoughAllowance =
    currentAllowance !== undefined && currentAllowance >= parsedAmount && parsedAmount > BigInt(0);

  const handleApprove = async () => {
    try {
      setStatusMsg("Approving STK in MetaMask...");
      await writeContractAsync({
        address: STAKE_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [STAKING_POOL_ADDRESS, parsedAmount],
      });
      await refetchAllowance();
      setStatusMsg("STK Approved! Click Stake STK next.");
    } catch (err: unknown) {
      const error = err as { shortMessage?: string };
      setStatusMsg(error?.shortMessage || "Approval cancelled or failed.");
    }
  };

  const handleStake = async () => {
    try {
      setStatusMsg("Staking STK...");
      await writeContractAsync({
        address: STAKING_POOL_ADDRESS,
        abi: STAKING_POOL_ABI,
        functionName: "stake",
        args: [parsedAmount, stakeMode, rewardMode],
      });
      refreshAll();
      setStatusMsg("Stake confirmed!");
    } catch (err: unknown) {
      const error = err as { shortMessage?: string };
      setStatusMsg(error?.shortMessage || "Stake failed.");
    }
  };

  const handleWithdraw = async () => {
    try {
      setStatusMsg("Processing withdrawal...");
      await writeContractAsync({
        address: STAKING_POOL_ADDRESS,
        abi: STAKING_POOL_ABI,
        functionName: "withdraw",
        args: [withdrawMode],
      });
      refreshAll();
      setStatusMsg("Withdrawal complete!");
    } catch (err: unknown) {
      const error = err as { shortMessage?: string };
      setStatusMsg(error?.shortMessage || "Withdrawal failed.");
    }
  };

  if (!mounted) return null;

  const isStaked = position ? position[5] : false;
  const stakedBalance = position ? formatEther(position[0]) : "0";
  const activeStakeMode = position ? Number(position[3]) : 0;
  const activeRewardMode = position ? Number(position[4]) : 0;
  const startTime = position ? Number(position[1]) : 0;

  const lockDays = activeStakeMode === 1 ? 30 : activeStakeMode === 2 ? 90 : 0;
  const unlockDate = startTime > 0 ? new Date((startTime + lockDays * 86400) * 1000).toLocaleString() : "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Dual-Token Yield Protocol
            </span>
            <h1 className="text-2xl font-bold text-white">STK to RWD Staking Vault</h1>
          </div>

          {!isConnected ? (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition cursor-pointer"
            >
              Connect MetaMask
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="bg-slate-800 border border-slate-700 text-slate-300 text-sm px-3 py-1.5 rounded-lg font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-950/70 to-slate-900 border border-indigo-500/30 p-5 rounded-2xl">
            <p className="text-sm text-indigo-300">Total Value Locked (Pool TVL)</p>
            <p className="text-3xl font-bold text-white mt-1">
              {poolTvl ? Number(formatEther(poolTvl)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}{" "}
              <span className="text-base font-normal text-indigo-400">STK</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-950/70 to-slate-900 border border-emerald-500/30 p-5 rounded-2xl">
            <p className="text-sm text-emerald-300">Available Reward Reserve</p>
            <p className="text-3xl font-bold text-white mt-1">
              {rewardReserve
                ? Number(formatEther(rewardReserve)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                : "0"}{" "}
              <span className="text-base font-normal text-emerald-400">RWD</span>
            </p>
          </div>
        </div>

        {statusMsg && (
          <div className="bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 px-4 py-3 rounded-xl text-sm flex justify-between items-center">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg("")} className="text-indigo-400 hover:text-white font-bold">
              X
            </button>
          </div>
        )}

        {isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">1. Stake Tokens</h2>
                <span className="text-xs text-slate-400">
                  Wallet: {userStkBalance ? Number(formatEther(userStkBalance)).toLocaleString() : "0"} STK
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Amount to Stake</span>
                  {userStkBalance !== undefined && !isStaked && (
                    <button
                      onClick={() => setAmount(formatEther(userStkBalance))}
                      className="text-indigo-400 hover:underline cursor-pointer"
                    >
                      Max
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isStaked}
                    placeholder="0.0"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-white outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-3 text-sm font-semibold text-slate-400">STK</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Way of Staking (Lock Tier)</label>
                <div className="grid grid-cols-3 gap-2">
                  {STAKE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isStaked}
                      onClick={() => setStakeMode(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer disabled:opacity-50 ${
                        stakeMode === opt.id
                          ? "bg-indigo-600/20 border-indigo-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <p className="text-xs font-bold">{opt.title}</p>
                      <p className="text-[11px] text-indigo-400 mt-0.5">{opt.rate}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Way of Rewarding</label>
                <div className="grid grid-cols-2 gap-2">
                  {REWARD_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isStaked}
                      onClick={() => setRewardMode(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer disabled:opacity-50 ${
                        rewardMode === opt.id
                          ? "bg-emerald-600/20 border-emerald-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <p className="text-xs font-bold">{opt.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleApprove}
                  disabled={isStaked || isPending || hasEnoughAllowance}
                  className={`w-1/2 py-3 rounded-xl font-semibold text-sm transition cursor-pointer ${
                    hasEnoughAllowance
                      ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 cursor-default"
                      : "bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40"
                  }`}
                >
                  {hasEnoughAllowance ? "Approved" : isPending ? "Waiting..." : "1. Approve STK"}
                </button>

                <button
                  onClick={handleStake}
                  disabled={isStaked || isPending || !hasEnoughAllowance}
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-40 cursor-pointer"
                >
                  {isPending ? "Staking..." : "2. Stake STK"}
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-white">2. Your Position</h2>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      isStaked
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isStaked ? "Active" : "No Active Stake"}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Staked Principal:</span>
                    <span className="font-bold text-white">{stakedBalance} STK</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Live Pending Reward:</span>
                    <span className="font-bold text-emerald-400">
                      {pendingReward ? Number(formatEther(pendingReward)).toFixed(6) : "0.000000"} RWD
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Wallet RWD Balance:</span>
                    <span className="text-slate-200">
                      {userRwdBalance ? Number(formatEther(userRwdBalance)).toFixed(4) : "0"} RWD
                    </span>
                  </div>
                  {isStaked && (
                    <>
                      <div className="border-t border-slate-800 pt-2 flex justify-between text-xs">
                        <span className="text-slate-400">Selected Strategy:</span>
                        <span className="text-indigo-300">
                          {STAKE_OPTIONS[activeStakeMode]?.title} / {REWARD_OPTIONS[activeRewardMode]?.title}
                        </span>
                      </div>
                      {lockDays > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Unlocks At:</span>
                          <span className="text-amber-400">{unlockDate}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Way of Withdrawing</label>
                  <select
                    value={withdrawMode}
                    onChange={(e) => setWithdrawMode(Number(e.target.value))}
                    disabled={!isStaked}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none disabled:opacity-40"
                  >
                    <option value={0}>Full Exit (Unstake STK + Claim RWD)</option>
                    <option value={1}>Claim Rewards Only (Keep STK Staked)</option>
                    <option value={2} disabled={activeStakeMode === 0}>
                      Emergency Early Exit (Locked Only - 10% STK Penalty)
                    </option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleWithdraw}
                disabled={!isStaked || isPending}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-40 cursor-pointer"
              >
                {isPending ? "Executing..." : "Execute Withdrawal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
