pragma solidity 0.6.12;

import "@pancakeswap/pancake-swap-lib/contracts/math/SafeMath.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/utils/ReentrancyGuard.sol";

interface IMasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;

    function userInfo(uint256 _pid, address _address)
        external
        returns (uint256, uint256);

    function poolInfo(uint256 _pid)
        external
        returns (
            IBEP20,
            uint256,
            uint256,
            uint256,
            uint16
        );
}

contract IFO is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many tokens the user has provided.
        bool claimed; // default false
    }

    uint256 internal constant UINT_MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    // admin address
    address public adminAddress;
    // The raising token
    IBEP20 public lpToken;
    // The offering token
    IBEP20 public offeringToken;
    // The block number when IFO starts
    uint256 public startBlock;
    // The block number when IFO ends
    uint256 public endBlock;
    // total amount of raising tokens need to be raised
    uint256 public raisingAmount;
    // total amount of offeringToken that will offer
    uint256 public offeringAmount;
    // total amount of raising tokens that have already raised
    uint256 public totalAmount;
    // address => amount
    mapping(address => UserInfo) public userInfo;
    // participators
    address[] public addressList;
    // The masterchef where to farming
    IMasterChef public masterChef;
    // The farming pool id
    uint256 public pid;
    // is approved to Farming
    bool public approved;
    // is farming ended
    bool public farmEnded;
    // The reward Token of Farming
    IBEP20 public farmRewardToken;
    // The total amount of farming reward Token
    uint256 public totalRewardTokenAmount;

    event Deposit(address indexed user, uint256 amount);
    event Harvest(
        address indexed user,
        uint256 offeringAmount,
        uint256 excessAmount,
        uint256 rewardTokenAmount
    );

    constructor(
        IBEP20 _lpToken,
        IBEP20 _offeringToken,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _offeringAmount,
        uint256 _raisingAmount,
        address _adminAddress,
        IMasterChef _masterChef,
        uint256 _pid,
        IBEP20 _farmRewardToken
    ) public {
        require(
            address(_lpToken) != address(_offeringToken),
            "lpToken and offeringToken cannot be the same address"
        );
        require(
            address(_lpToken) != address(_farmRewardToken),
            "lpToken and farmRewardToken cannot be the same address"
        );
        require(
            address(_offeringToken) != address(_farmRewardToken),
            "offeringToken and farmRewardToken cannot be the same address"
        );
        require(
            _startBlock < _endBlock,
            "startBlock must be lower than endBlock"
        );
        require(
            block.number < _startBlock,
            "startBlock must be higher than current block"
        );
        require(_offeringAmount > 0, "invalid offeringAmount");
        require(_raisingAmount > 0, "invalid raisingAmount");
        require(
            _adminAddress != address(0),
            "adminAddress cannot be the zero address"
        );

        // test if masterChef address and pid is the correct value
        _masterChef.poolInfo(_pid);

        lpToken = _lpToken;
        offeringToken = _offeringToken;
        startBlock = _startBlock;
        endBlock = _endBlock;
        offeringAmount = _offeringAmount;
        raisingAmount = _raisingAmount;
        totalAmount = 0;
        adminAddress = _adminAddress;
        masterChef = _masterChef;
        pid = _pid;
        farmRewardToken = _farmRewardToken;
    }

    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "admin: wut?");
        _;
    }

    function setOfferingAmount(uint256 _offerAmount) public onlyAdmin {
        require(block.number < startBlock, "no");
        offeringAmount = _offerAmount;
    }

    function setRaisingAmount(uint256 _raisingAmount) public onlyAdmin {
        require(block.number < startBlock, "no");
        raisingAmount = _raisingAmount;
    }

    function updateStartAndEndBlocks(uint256 _startBlock, uint256 _endBlock)
        public
        onlyAdmin
    {
        require(block.number < startBlock, "IFO has started");
        require(
            _startBlock < _endBlock,
            "New startBlock must be lower than new endBlock"
        );
        require(
            block.number < _startBlock,
            "New startBlock must be higher than current block"
        );

        startBlock = _startBlock;
        endBlock = _endBlock;
    }

    function approve() public onlyAdmin {
        require(!approved, "Approved already");
        lpToken.safeApprove(address(masterChef), UINT_MAX);
        approved = true;
    }

    function deposit(uint256 _amount) public {
        require(
            block.number > startBlock && block.number < endBlock,
            "not ifo time"
        );
        require(_amount > 0, "need _amount > 0");
        uint256 balanceBefore = lpToken.balanceOf(address(this));
        lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        _amount = lpToken.balanceOf(address(this)).sub(balanceBefore);
        if (approved) {
            masterChef.deposit(pid, _amount);
        }
        if (userInfo[msg.sender].amount == 0) {
            addressList.push(address(msg.sender));
        }
        userInfo[msg.sender].amount = userInfo[msg.sender].amount.add(_amount);
        totalAmount = totalAmount.add(_amount);
        emit Deposit(msg.sender, _amount);
    }

    function harvest() public nonReentrant {
        require(block.number > endBlock, "not harvest time");
        require(farmEnded, "Farming not end");
        require(userInfo[msg.sender].amount > 0, "have you participated?");
        require(!userInfo[msg.sender].claimed, "nothing to harvest");
        uint256 offeringTokenAmount = getOfferingAmount(msg.sender);
        uint256 refundingTokenAmount = getRefundingAmount(msg.sender);
        uint256 rewardTokenAmount = getRewardTokenAmount(msg.sender);
        offeringToken.safeTransfer(address(msg.sender), offeringTokenAmount);
        if (refundingTokenAmount > 0) {
            lpToken.safeTransfer(address(msg.sender), refundingTokenAmount);
        }
        if (rewardTokenAmount > 0) {
            farmRewardToken.safeTransfer(
                address(msg.sender),
                rewardTokenAmount
            );
        }
        userInfo[msg.sender].claimed = true;
        emit Harvest(
            msg.sender,
            offeringTokenAmount,
            refundingTokenAmount,
            rewardTokenAmount
        );
    }

    function hasHarvest(address _user) external view returns (bool) {
        return userInfo[_user].claimed;
    }

    // allocation 100000 means 0.1(10%), 1 meanss 0.000001(0.0001%), 1000000 means 1(100%)
    function getUserAllocation(address _user) public view returns (uint256) {
        return userInfo[_user].amount.mul(1e12).div(totalAmount).div(1e6);
    }

    // get the amount of IFO token you will get
    function getOfferingAmount(address _user) public view returns (uint256) {
        if (totalAmount > raisingAmount) {
            uint256 allocation = getUserAllocation(_user);
            return offeringAmount.mul(allocation).div(1e6);
        } else {
            // userInfo[_user] / (raisingAmount / offeringAmount)
            return
                userInfo[_user].amount.mul(offeringAmount).div(raisingAmount);
        }
    }

    // get the amount of reward token you will get
    function getRewardTokenAmount(address _user) public view returns (uint256) {
        uint256 allocation = getUserAllocation(_user);
        return totalRewardTokenAmount.mul(allocation).div(1e6);
    }

    // get the amount of lp token you will be refunded
    function getRefundingAmount(address _user) public view returns (uint256) {
        if (totalAmount <= raisingAmount) {
            return 0;
        }
        uint256 allocation = getUserAllocation(_user);
        uint256 payAmount = raisingAmount.mul(allocation).div(1e6);
        return userInfo[_user].amount.sub(payAmount);
    }

    function getAddressListLength() external view returns (uint256) {
        return addressList.length;
    }

    function _endFarmStaking() internal {
        require(!farmEnded, "Farming ended already");
        (uint256 amount, ) = masterChef.userInfo(pid, address(this));
        if (amount > 0) {
            masterChef.withdraw(pid, amount);
            totalRewardTokenAmount = farmRewardToken.balanceOf(address(this));
        }
        farmEnded = true;
    }

    function endFarmStaking() public nonReentrant {
        require(block.number > endBlock, "IFO not end");
        _endFarmStaking();
    }

    function finalWithdrawLPToken(uint256 _lpAmount) public onlyAdmin {
        require(
            block.number > endBlock + 201600,
            "not after 7 days of IFO ended"
        );
        require(
            _lpAmount <= lpToken.balanceOf(address(this)),
            "not enough LP Token"
        );
        lpToken.safeTransfer(address(msg.sender), _lpAmount);
    }

    function finalWithdrawOfferingToken(uint256 _offerAmount) public onlyAdmin {
        require(
            block.number > endBlock + 201600,
            "not after 7 days of IFO ended"
        );
        require(
            _offerAmount <= offeringToken.balanceOf(address(this)),
            "not enough offering Token"
        );
        offeringToken.safeTransfer(address(msg.sender), _offerAmount);
    }
}
