// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    enum State {
        AWAITING_PAYMENT,
        AWAITING_DELIVERY,
        COMPLETE,
        DISPUTED,
        REFUNDED
    }

    address public buyer;
    address public seller;
    address public arbiter;

    uint256 public amount;
    State public state;

    event Deposited(address indexed buyer, uint256 amount);
    event DeliveryConfirmed(address indexed buyer);
    event DisputeOpened(address indexed buyer);
    event Resolved(address indexed arbiter, bool paidToSeller);
    event Refunded(address indexed buyer);

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Not buyer");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Not arbiter");
        _;
    }

    modifier inState(State _state) {
        require(state == _state, "Invalid state");
        _;
    }

    constructor(address _seller, address _arbiter) {
        require(_seller != address(0) && _arbiter != address(0), "Invalid address");
        buyer = msg.sender; // quien despliega es el buyer
        seller = _seller;
        arbiter = _arbiter;
        state = State.AWAITING_PAYMENT;
    }

    // Buyer deposita el dinero
    function deposit() external payable onlyBuyer inState(State.AWAITING_PAYMENT) {
        require(msg.value > 0, "No ETH sent");
        amount = msg.value;
        state = State.AWAITING_DELIVERY;
        emit Deposited(buyer, msg.value);
    }

    // Buyer confirma que recibió el producto => paga al seller
    function confirmDelivery() external onlyBuyer inState(State.AWAITING_DELIVERY) {
        state = State.COMPLETE;
        emit DeliveryConfirmed(buyer);

        (bool ok, ) = seller.call{value: amount}("");
        require(ok, "Payment failed");
    }

    // Buyer abre disputa
    function openDispute() external onlyBuyer inState(State.AWAITING_DELIVERY) {
        state = State.DISPUTED;
        emit DisputeOpened(buyer);
    }

    // Arbiter decide: true => pagar al seller, false => devolver al buyer
    function resolve(bool paySeller) external onlyArbiter inState(State.DISPUTED) {
        if (paySeller) {
            state = State.COMPLETE;
            emit Resolved(arbiter, true);

            (bool ok, ) = seller.call{value: amount}("");
            require(ok, "Payment failed");
        } else {
            state = State.REFUNDED;
            emit Resolved(arbiter, false);

            (bool ok, ) = buyer.call{value: amount}("");
            require(ok, "Refund failed");
            emit Refunded(buyer);
        }
    }

    receive() external payable {
        revert("Use deposit()");
    }
}
