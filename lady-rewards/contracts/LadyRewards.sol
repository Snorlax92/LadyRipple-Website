// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.9.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts@4.9.6/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts@4.9.6/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.6/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts@4.9.6/security/ReentrancyGuard.sol";

/**
 * LadyRewards — Weekly Buy Leaderboard + Lady Crown rewards for $LRP
 *
 * Flow:
 *   1. Owner funds contract with LRP each week via fundRewards()
 *   2. Backend indexer watches LRP/LADY pair, builds leaderboard
 *   3. At week end, backend signs claim messages for top 10 + crown winner
 *   4. Winners call claim() with their signed proof to receive LRP
 */
contract LadyRewards is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    IERC20 public immutable lrp;
    address public signer;

    // week number => wallet => claimed
    mapping(uint256 => mapping(address => bool)) public claimed;

    struct Crown {
        address holder;
        uint256 week;
        uint256 buyAmount; // largest single buy that won the crown (in LRP)
    }
    Crown public currentCrown;

    event RewardClaimed(address indexed user, uint256 indexed week, uint256 rewardAmount);
    event CrownAwarded(address indexed holder, uint256 indexed week, uint256 buyAmount);
    event RewardsFunded(address indexed funder, uint256 amount);
    event SignerUpdated(address newSigner);

    constructor(address _lrp, address _signer) {
        require(_lrp != address(0), "Invalid LRP address");
        require(_signer != address(0), "Invalid signer address");
        lrp = IERC20(_lrp);
        signer = _signer;
    }

    /**
     * Claim a reward for a given week.
     * @param week       Week number (unix timestamp / 604800)
     * @param amount     LRP amount to receive
     * @param isCrown    True if this claim also awards the Lady Crown
     * @param buyAmount  Winning buy size (only relevant when isCrown = true)
     * @param signature  Backend signature over (week, msg.sender, amount, isCrown, buyAmount)
     */
    function claim(
        uint256 week,
        uint256 amount,
        bool isCrown,
        uint256 buyAmount,
        bytes calldata signature
    ) external nonReentrant {
        require(!claimed[week][msg.sender], "Already claimed this week");
        require(amount > 0, "Nothing to claim");
        require(lrp.balanceOf(address(this)) >= amount, "Insufficient reward pool");

        bytes32 hash = keccak256(
            abi.encodePacked(week, msg.sender, amount, isCrown, buyAmount)
        );
        bytes32 ethHash = hash.toEthSignedMessageHash();
        require(ethHash.recover(signature) == signer, "Invalid signature");

        claimed[week][msg.sender] = true;

        if (isCrown) {
            currentCrown = Crown(msg.sender, week, buyAmount);
            emit CrownAwarded(msg.sender, week, buyAmount);
        }

        lrp.safeTransfer(msg.sender, amount);
        emit RewardClaimed(msg.sender, week, amount);
    }

    /**
     * Fund the reward pool. Call approve() on LRP token first.
     */
    function fundRewards(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        lrp.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardsFunded(msg.sender, amount);
    }

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    function rewardPoolBalance() external view returns (uint256) {
        return lrp.balanceOf(address(this));
    }

    function withdrawExcess(uint256 amount) external onlyOwner {
        lrp.safeTransfer(owner(), amount);
    }
}
