// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Records supply-chain shipments and immutable breach events
/// (temperature, humidity, vibration) with GPS location, on-chain.
contract ShipmentRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEVICE_ROLE = keccak256("DEVICE_ROLE");

    enum BreachType {
        Temperature,
        Humidity,
        Vibration
    }

    enum ShipmentStatus {
        InTransit,
        Breached,
        Delivered
    }

    struct Thresholds {
        int256 tempMin; // degrees C, scaled by 100 (e.g. -5.25C = -525)
        int256 tempMax;
        uint256 humidityMin; // percent, scaled by 100
        uint256 humidityMax;
        uint256 vibrationMax; // arbitrary sensor units, scaled by 100
    }

    struct Shipment {
        string product;
        string origin;
        string destination;
        Thresholds thresholds;
        ShipmentStatus status;
        bool exists;
    }

    struct Breach {
        BreachType breachType;
        int256 measuredValue;
        int256 lat; // degrees, scaled by 1e6
        int256 lon; // degrees, scaled by 1e6
        uint256 timestamp;
        string deviceId;
    }

    mapping(string => Shipment) private shipments;
    mapping(string => Breach[]) private shipmentBreaches;
    string[] private shipmentIds;

    event ShipmentCreated(
        string indexed shipmentId,
        string product,
        string origin,
        string destination
    );

    event BreachRecorded(
        string indexed shipmentId,
        BreachType breachType,
        int256 measuredValue,
        int256 lat,
        int256 lon,
        uint256 timestamp,
        string deviceId
    );

    event ShipmentDelivered(string indexed shipmentId);

    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);
    }

    modifier shipmentExists(string calldata shipmentId) {
        require(shipments[shipmentId].exists, "shipment does not exist");
        _;
    }

    function createShipment(
        string calldata shipmentId,
        string calldata product,
        string calldata origin,
        string calldata destination,
        int256 tempMin,
        int256 tempMax,
        uint256 humidityMin,
        uint256 humidityMax,
        uint256 vibrationMax
    ) external onlyRole(ADMIN_ROLE) {
        require(!shipments[shipmentId].exists, "shipment already exists");
        require(tempMin <= tempMax, "tempMin must be <= tempMax");
        require(humidityMin <= humidityMax, "humidityMin must be <= humidityMax");

        shipments[shipmentId] = Shipment({
            product: product,
            origin: origin,
            destination: destination,
            thresholds: Thresholds({
                tempMin: tempMin,
                tempMax: tempMax,
                humidityMin: humidityMin,
                humidityMax: humidityMax,
                vibrationMax: vibrationMax
            }),
            status: ShipmentStatus.InTransit,
            exists: true
        });
        shipmentIds.push(shipmentId);

        emit ShipmentCreated(shipmentId, product, origin, destination);
    }

    function recordBreach(
        string calldata shipmentId,
        BreachType breachType,
        int256 measuredValue,
        int256 lat,
        int256 lon,
        uint256 timestamp,
        string calldata deviceId
    ) external onlyRole(DEVICE_ROLE) shipmentExists(shipmentId) {
        Shipment storage shipment = shipments[shipmentId];
        require(shipment.status != ShipmentStatus.Delivered, "shipment already delivered");

        shipmentBreaches[shipmentId].push(
            Breach({
                breachType: breachType,
                measuredValue: measuredValue,
                lat: lat,
                lon: lon,
                timestamp: timestamp,
                deviceId: deviceId
            })
        );

        shipment.status = ShipmentStatus.Breached;

        emit BreachRecorded(shipmentId, breachType, measuredValue, lat, lon, timestamp, deviceId);
    }

    function markDelivered(string calldata shipmentId)
        external
        onlyRole(ADMIN_ROLE)
        shipmentExists(shipmentId)
    {
        shipments[shipmentId].status = ShipmentStatus.Delivered;
        emit ShipmentDelivered(shipmentId);
    }

    function getShipment(string calldata shipmentId)
        external
        view
        shipmentExists(shipmentId)
        returns (
            string memory product,
            string memory origin,
            string memory destination,
            Thresholds memory thresholds,
            ShipmentStatus status
        )
    {
        Shipment storage s = shipments[shipmentId];
        return (s.product, s.origin, s.destination, s.thresholds, s.status);
    }

    function getBreaches(string calldata shipmentId)
        external
        view
        shipmentExists(shipmentId)
        returns (Breach[] memory)
    {
        return shipmentBreaches[shipmentId];
    }

    function getShipmentIds() external view returns (string[] memory) {
        return shipmentIds;
    }
}
