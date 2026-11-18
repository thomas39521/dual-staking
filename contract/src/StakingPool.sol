// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract StakingPool is ReentrancyGuard {
    using Math for uint256;

    IERC20 public immutable stakeToken;
    IERC20 public immutable rewardToken;

    enum StakeMode { FLEXIBLE, LOCKED_30_DAYS, LOCKED_90_DAYS }
    enum RewardMode { APR_SIMPLE, APY_COMPOUNDED }
    enum WithdrawMode { FULL_EXIT, CLAIM_REWARDS_ONLY, EMERGENCY_EARLY_EXIT }

    struct StakePosition {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        StakeMode stakeMode;
        RewardMode rewardMode;
        bool active;
    }

    mapping(address => StakePosition) public positions;

    event Staked(address indexed user, uint256 amount, StakeMode stakeMode, RewardMode rewardMode);
    event Withdrawn(address indexed user, WithdrawMode withdrawMode, uint256 principalReturned, uint256 rewardPaid);

    constructor(address _stakeToken, address _rewardToken) {
        stakeToken = IERC20(_stakeToken);
        rewardToken = IERC20(_rewardToken);
    }

    function stake(uint256 _amount, StakeMode _sMode, RewardMode _rMode) external nonReentrant {
        require(_amount > 0, "Cannot stake 0");
        require(!positions[msg.sender].active, "Active stake exists");

        require(stakeToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        positions[msg.sender] = StakePosition({
            amount: _amount,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            stakeMode: _sMode,
            rewardMode: _rMode,
            active: true
        });

        emit Staked(msg.sender, _amount, _sMode, _rMode);
    }

    function calculateReward(address _user) public view returns (uint256) {
        StakePosition memory pos = positions[_user];
        if (!pos.active) return 0;

        uint256 duration = block.timestamp - pos.lastClaimTime;
        
        // Base rate: 10% (1000 bps)
        uint256 rateBps = 1000; 
        if (pos.stakeMode == StakeMode.LOCKED_30_DAYS) {
            rateBps += 500;  // 15% nominal
        } else if (pos.stakeMode == StakeMode.LOCKED_90_DAYS) {
            rateBps += 1200; // 22% nominal
        }

        if (pos.rewardMode == RewardMode.APR_SIMPLE) {
            return pos.amount.mulDiv(rateBps * duration, 10000 * 365 days);
        } else {
            uint256 daysElapsed = duration / 1 days;
            uint256 remainingSeconds = duration % 1 days;

            uint256 compoundedPrincipal = pos.amount;
            uint256 dailyRateWad = (rateBps * 1e18) / (10000 * 365);

            for (uint256 i = 0; i < daysElapsed; i++) {
                uint256 dailyInterest = compoundedPrincipal.mulDiv(dailyRateWad, 1e18);
                compoundedPrincipal += dailyInterest;
            }

            uint256 partialDayReward = compoundedPrincipal.mulDiv(rateBps * remainingSeconds, 10000 * 365 days);
            return (compoundedPrincipal + partialDayReward) - pos.amount;
        }
    }

    function withdraw(WithdrawMode _wMode) external nonReentrant {
        StakePosition storage pos = positions[msg.sender];
        require(pos.active, "No active stake");

        uint256 reward = calculateReward(msg.sender);
        uint256 stakedAmount = pos.amount;

        // 1. Claim Rewards Only (Keep Principal Staked)
        if (_wMode == WithdrawMode.CLAIM_REWARDS_ONLY) {
            require(reward > 0, "No rewards to claim");
            pos.lastClaimTime = block.timestamp;

            require(rewardToken.balanceOf(address(this)) >= reward, "Insufficient pool rewards");
            require(rewardToken.transfer(msg.sender, reward), "Reward transfer failed");

            emit Withdrawn(msg.sender, _wMode, 0, reward);
            return;
        }

        uint256 unlockTime = pos.startTime;
        if (pos.stakeMode == StakeMode.LOCKED_30_DAYS) unlockTime += 30 days;
        if (pos.stakeMode == StakeMode.LOCKED_90_DAYS) unlockTime += 90 days;

        // 2. Emergency Early Exit (Break Lock with 10% Penalty, 0 Rewards)
        if (_wMode == WithdrawMode.EMERGENCY_EARLY_EXIT) {
            require(pos.stakeMode != StakeMode.FLEXIBLE, "Use FULL_EXIT for flexible stakes");
            require(block.timestamp < unlockTime, "Lock ended, use FULL_EXIT");

            pos.active = false;
            pos.amount = 0;

            uint256 penalty = stakedAmount.mulDiv(10, 100);
            uint256 amountAfterPenalty = stakedAmount - penalty;

            require(stakeToken.transfer(msg.sender, amountAfterPenalty), "Emergency transfer failed");
            emit Withdrawn(msg.sender, _wMode, amountAfterPenalty, 0);
            return;
        }

        // 3. Full Exit (Principal + All Rewards)
        require(block.timestamp >= unlockTime, "Tokens are still locked");

        pos.active = false;
        pos.amount = 0;

        require(stakeToken.transfer(msg.sender, stakedAmount), "Stake return failed");
        
        if (reward > 0) {
            require(rewardToken.balanceOf(address(this)) >= reward, "Insufficient pool rewards");
            require(rewardToken.transfer(msg.sender, reward), "Reward transfer failed");
        }

        emit Withdrawn(msg.sender, _wMode, stakedAmount, reward);
    }
}