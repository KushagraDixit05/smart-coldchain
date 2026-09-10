const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ShipmentRegistry", function () {
  let registry, admin, device, other;

  const BreachType = { Temperature: 0, Humidity: 1, Vibration: 2 };

  const sampleShipment = {
    id: "SHP-1001",
    product: "Vaccines",
    origin: "Mumbai Warehouse",
    destination: "Delhi Cold Storage",
    tempMin: -500, // -5.00C
    tempMax: 800, // 8.00C
    humidityMin: 2000, // 20.00%
    humidityMax: 6000, // 60.00%
    vibrationMax: 500, // 5.00 units
  };

  beforeEach(async function () {
    [admin, device, other] = await ethers.getSigners();

    const ShipmentRegistry = await ethers.getContractFactory("ShipmentRegistry");
    registry = await ShipmentRegistry.deploy(admin.address);
    await registry.waitForDeployment();

    const DEVICE_ROLE = await registry.DEVICE_ROLE();
    await registry.connect(admin).grantRole(DEVICE_ROLE, device.address);
  });

  async function createSampleShipment(signer = admin) {
    return registry
      .connect(signer)
      .createShipment(
        sampleShipment.id,
        sampleShipment.product,
        sampleShipment.origin,
        sampleShipment.destination,
        sampleShipment.tempMin,
        sampleShipment.tempMax,
        sampleShipment.humidityMin,
        sampleShipment.humidityMax,
        sampleShipment.vibrationMax
      );
  }

  describe("access control", function () {
    it("allows admin to create a shipment", async function () {
      await expect(createSampleShipment(admin))
        .to.emit(registry, "ShipmentCreated")
        .withArgs(sampleShipment.id, sampleShipment.product, sampleShipment.origin, sampleShipment.destination);
    });

    it("rejects shipment creation from a non-admin account", async function () {
      await expect(createSampleShipment(other)).to.be.reverted;
    });

    it("rejects breach recording from a non-device account", async function () {
      await createSampleShipment(admin);
      await expect(
        registry
          .connect(other)
          .recordBreach(sampleShipment.id, BreachType.Temperature, 1200, 28613900, 77209000, 1757500000, "esp32-01")
      ).to.be.reverted;
    });

    it("allows a device-role account to record a breach", async function () {
      await createSampleShipment(admin);
      await expect(
        registry
          .connect(device)
          .recordBreach(sampleShipment.id, BreachType.Temperature, 1200, 28613900, 77209000, 1757500000, "esp32-01")
      ).to.emit(registry, "BreachRecorded");
    });

    it("rejects markDelivered from a non-admin account", async function () {
      await createSampleShipment(admin);
      await expect(registry.connect(other).markDelivered(sampleShipment.id)).to.be.reverted;
    });
  });

  describe("shipment lifecycle & threshold validation", function () {
    it("rejects creating a shipment with tempMin > tempMax", async function () {
      await expect(
        registry
          .connect(admin)
          .createShipment(sampleShipment.id, sampleShipment.product, sampleShipment.origin, sampleShipment.destination, 800, -500, sampleShipment.humidityMin, sampleShipment.humidityMax, sampleShipment.vibrationMax)
      ).to.be.revertedWith("tempMin must be <= tempMax");
    });

    it("rejects creating a shipment with humidityMin > humidityMax", async function () {
      await expect(
        registry
          .connect(admin)
          .createShipment(sampleShipment.id, sampleShipment.product, sampleShipment.origin, sampleShipment.destination, sampleShipment.tempMin, sampleShipment.tempMax, 6000, 2000, sampleShipment.vibrationMax)
      ).to.be.revertedWith("humidityMin must be <= humidityMax");
    });

    it("rejects creating a duplicate shipment id", async function () {
      await createSampleShipment(admin);
      await expect(createSampleShipment(admin)).to.be.revertedWith("shipment already exists");
    });

    it("rejects operations on a non-existent shipment", async function () {
      await expect(registry.getShipment("NOPE")).to.be.revertedWith("shipment does not exist");
      await expect(registry.connect(admin).markDelivered("NOPE")).to.be.revertedWith("shipment does not exist");
    });

    it("marks status Breached after a breach is recorded, and rejects breaches after delivery", async function () {
      await createSampleShipment(admin);

      let [, , , , status] = await registry.getShipment(sampleShipment.id);
      expect(status).to.equal(0); // InTransit

      await registry
        .connect(device)
        .recordBreach(sampleShipment.id, BreachType.Vibration, 900, 28613900, 77209000, 1757500000, "esp32-01");

      [, , , , status] = await registry.getShipment(sampleShipment.id);
      expect(status).to.equal(1); // Breached

      const breaches = await registry.getBreaches(sampleShipment.id);
      expect(breaches.length).to.equal(1);
      expect(breaches[0].breachType).to.equal(BreachType.Vibration);
      expect(breaches[0].measuredValue).to.equal(900);
      expect(breaches[0].deviceId).to.equal("esp32-01");

      await registry.connect(admin).markDelivered(sampleShipment.id);
      [, , , , status] = await registry.getShipment(sampleShipment.id);
      expect(status).to.equal(2); // Delivered

      await expect(
        registry
          .connect(device)
          .recordBreach(sampleShipment.id, BreachType.Vibration, 900, 28613900, 77209000, 1757500001, "esp32-01")
      ).to.be.revertedWith("shipment already delivered");
    });

    it("tracks multiple shipment ids", async function () {
      await createSampleShipment(admin);
      await registry
        .connect(admin)
        .createShipment("SHP-1002", "Frozen Fish", "Kochi Port", "Bengaluru Hub", -2000, -500, 3000, 7000, 400);

      const ids = await registry.getShipmentIds();
      expect(ids).to.deep.equal([sampleShipment.id, "SHP-1002"]);
    });
  });
});
