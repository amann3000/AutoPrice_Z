pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract AutoInsurancePricing is ZamaEthereumConfig {
    struct DriverProfile {
        address driverAddress;
        euint32 encryptedMileage;
        euint32 encryptedSpeedingEvents;
        uint256 publicAge;
        uint256 publicVehicleValue;
        uint256 basePremium;
        uint256 timestamp;
        uint32 decryptedDiscount;
        bool isVerified;
    }

    mapping(address => DriverProfile) public driverProfiles;
    address[] public driverAddresses;

    event ProfileCreated(address indexed driver, uint256 timestamp);
    event DiscountCalculated(address indexed driver, uint32 discount);
    event DecryptionVerified(address indexed driver, uint32 decryptedValue);

    constructor() ZamaEthereumConfig() {
    }

    function createDriverProfile(
        externalEuint32 encryptedMileage,
        bytes calldata mileageProof,
        externalEuint32 encryptedSpeedingEvents,
        bytes calldata speedingProof,
        uint256 age,
        uint256 vehicleValue,
        uint256 basePremium
    ) external {
        require(driverProfiles[msg.sender].driverAddress == address(0), "Profile already exists");

        euint32 mileage = FHE.fromExternal(encryptedMileage, mileageProof);
        euint32 speeding = FHE.fromExternal(encryptedSpeedingEvents, speedingProof);

        require(FHE.isInitialized(mileage), "Invalid mileage encryption");
        require(FHE.isInitialized(speeding), "Invalid speeding encryption");

        driverProfiles[msg.sender] = DriverProfile({
            driverAddress: msg.sender,
            encryptedMileage: mileage,
            encryptedSpeedingEvents: speeding,
            publicAge: age,
            publicVehicleValue: vehicleValue,
            basePremium: basePremium,
            timestamp: block.timestamp,
            decryptedDiscount: 0,
            isVerified: false
        });

        FHE.allowThis(mileage);
        FHE.allowThis(speeding);
        FHE.makePubliclyDecryptable(mileage);
        FHE.makePubliclyDecryptable(speeding);

        driverAddresses.push(msg.sender);
        emit ProfileCreated(msg.sender, block.timestamp);
    }

    function calculateDiscount() external {
        require(driverProfiles[msg.sender].driverAddress != address(0), "Profile does not exist");
        require(!driverProfiles[msg.sender].isVerified, "Discount already calculated");

        DriverProfile storage profile = driverProfiles[msg.sender];

        // Homomorphic calculations
        euint32 mileageDiscount = FHE.div(
            FHE.mul(profile.encryptedMileage, FHE.euint32(5)),
            FHE.euint32(1000)
        );

        euint32 speedingPenalty = FHE.mul(
            profile.encryptedSpeedingEvents,
            FHE.euint32(2)
        );

        euint32 netDiscount = FHE.sub(mileageDiscount, speedingPenalty);
        FHE.allowThis(netDiscount);

        // Public calculations
        uint32 ageDiscount = profile.publicAge > 30 ? 5 : 0;
        uint32 vehicleDiscount = profile.publicVehicleValue > 20000 ? 3 : 0;

        // Final discount calculation
        euint32 finalDiscount = FHE.add(
            netDiscount,
            FHE.add(
                FHE.euint32(ageDiscount),
                FHE.euint32(vehicleDiscount)
            )
        );
        FHE.allowThis(finalDiscount);

        profile.decryptedDiscount = FHE.decrypt(finalDiscount);
        profile.isVerified = true;

        emit DiscountCalculated(msg.sender, profile.decryptedDiscount);
    }

    function verifyDecryption(
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(driverProfiles[msg.sender].driverAddress != address(0), "Profile does not exist");
        require(!driverProfiles[msg.sender].isVerified, "Data already verified");

        DriverProfile storage profile = driverProfiles[msg.sender];

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(profile.encryptedMileage);
        cts[1] = FHE.toBytes32(profile.encryptedSpeedingEvents);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);

        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));
        profile.decryptedDiscount = decodedValue;
        profile.isVerified = true;

        emit DecryptionVerified(msg.sender, decodedValue);
    }

    function getDriverProfile(address driver) external view returns (
        uint256 age,
        uint256 vehicleValue,
        uint256 basePremium,
        uint256 timestamp,
        bool isVerified,
        uint32 decryptedDiscount
    ) {
        require(driverProfiles[driver].driverAddress != address(0), "Profile does not exist");
        DriverProfile storage profile = driverProfiles[driver];

        return (
            profile.publicAge,
            profile.publicVehicleValue,
            profile.basePremium,
            profile.timestamp,
            profile.isVerified,
            profile.decryptedDiscount
        );
    }

    function getAllDriverAddresses() external view returns (address[] memory) {
        return driverAddresses;
    }

    function getEncryptedMileage(address driver) external view returns (euint32) {
        require(driverProfiles[driver].driverAddress != address(0), "Profile does not exist");
        return driverProfiles[driver].encryptedMileage;
    }

    function getEncryptedSpeedingEvents(address driver) external view returns (euint32) {
        require(driverProfiles[driver].driverAddress != address(0), "Profile does not exist");
        return driverProfiles[driver].encryptedSpeedingEvents;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}


