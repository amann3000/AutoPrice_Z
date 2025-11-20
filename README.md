# AutoPrice_Z: Confidential Insurance Pricing

AutoPrice_Z is a cutting-edge platform designed to revolutionize the auto insurance industry by leveraging Zama's Fully Homomorphic Encryption (FHE) technology. This privacy-preserving application enables the uploading of encrypted driving behavior data, allowing users to compute insurance premium discounts without exposing personal information. By prioritizing user privacy, AutoPrice_Z ensures security while still delivering accurate pricing models.

## The Problem

In the digital age, the risk associated with cleartext data is significant, particularly in the insurance sector. Traditional insurance pricing models often require sensitive personal data, such as driving behavior, which poses a risk of data breaches and privacy violations. Cleartext data can be exposed to unauthorized access, leading to identity theft or misuse of information. Therefore, there is a pressing need for solutions that can operate without exposing sensitive data while providing accurate insurance pricing.

## The Zama FHE Solution

Fully Homomorphic Encryption (FHE) stands as a groundbreaking technology that allows computations to be performed directly on encrypted data. By utilizing Zama's unique libraries, such as fhevm and Concrete ML, AutoPrice_Z can securely process sensitive information, ensuring that user privacy is maintained throughout the insurance pricing process.

This framework provides a robust solution by allowing pricing models to operate on encrypted user data. For example, using fhevm to process encrypted inputs enables calculations that yield valuable insights without ever decrypting the underlying sensitive information. This means users can enjoy insurance services without being tracked or exposing their driving behavior.

## Key Features

- 🔒 **Privacy-Preserving Models**: Ensures that all user data remains encrypted and confidential during calculations.
- 📉 **Dynamic Premium Adjustments**: Calculates discounts based on encrypted driving behavior, ensuring fair pricing without compromising privacy.
- 🛡️ **No Tracking**: Protects user privacy by not tracking driving behavior or personal information.
- 🚗 **User-Friendly Interface**: Offers an intuitive platform for users to upload their data easily and view their insurance premiums.
- 📊 **Robust Pricing Models**: Utilizes advanced algorithms to generate accurate insurance pricing while adhering to privacy standards.

## Technical Architecture & Stack

### Technology Stack

- **Frontend**: React for the UI components
- **Backend**: Node.js and Express for handling requests
- **Database**: Encrypted MongoDB for storing encrypted user records
- **Privacy Engine**: Zama's FHE libraries (fhevm, Concrete ML) for computations on encrypted data

### Core Privacy Engine

Zama provides the essential infrastructure for ensuring that sensitive data remains protected while enabling sophisticated computations necessary for insurance pricing.

## Smart Contract / Core Logic

Below is a simplified pseudo-code snippet that illustrates how AutoPrice_Z utilizes Zama's FHE technology in its core logic:solidity
// Solidity snippet for calculating discounts
contract AutoPrice {

    function calculateDiscount(uint64 encryptedDrivingBehavior) public view returns (uint64) {
        // Decrypt the driving behavior using Zama's TFHE
        uint64 decryptedData = TFHE.decrypt(encryptedDrivingBehavior);

        // Calculate the discount based on decrypted data
        uint64 discount = premiumModel(decryptedData);

        // Encrypt the calculated discount before returning
        return TFHE.encrypt(discount);
    }
}

## Directory Structure

Here's an overview of the project's directory structure:
AutoPrice_Z/
├── contracts/
│   └── AutoPrice.sol
├── src/
│   ├── index.js
│   └── insuranceCalculator.js
├── scripts/
│   └── main.py
├── package.json
├── README.md
└── .env

## Installation & Setup

### Prerequisites

To set up AutoPrice_Z, you will need the following:

- Node.js installed on your machine
- Python 3.x for running the ML scripts
- Access to Zama's libraries

### Dependencies Installation

To install the necessary dependencies, execute the following commands in your terminal:

1. **Node.js dependencies**:bash
   npm install express react
   npm install --save fhevm

2. **Python dependencies**:bash
   pip install concrete-ml

## Build & Run

To build and run the project, follow these commands:

1. **For the frontend and backend**:bash
   npx hardhat compile
   npm start

2. **For the Python script**:bash
   python scripts/main.py

## Acknowledgements

We would like to extend our gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their innovative technology in Fully Homomorphic Encryption enables secure and private computations, laying the groundwork for AutoPrice_Z to deliver privacy-preserving insurance pricing solutions.

---

With AutoPrice_Z, the future of insurance is not only fairer but also safer, ensuring that users can reap the benefits of data-driven pricing without compromising their privacy.


