require("dotenv").config();
const router = require("express").Router();

const mongoose = require("mongoose");

const BannedUser = mongoose.model("BannedUser");
const BannedNFT = mongoose.model("BannedNFT");
const ERC721CONTRACT = mongoose.model("ERC721CONTRACT");
const NFTITEM = mongoose.model("NFTITEM");
const ERC1155HOLDING = mongoose.model("ERC1155HOLDING");
const Moderator = mongoose.model("Moderator");

const auth = require("./middleware/auth");
const toLowerCase = require("../utils/utils");
const validateSignature = require("../apis/middleware/auth.sign");

const adminAddress = process.env.ADMINADDRESS;

const extractAddress = require("../services/address.utils");

const isAdmin = (msgSender) => {
  return toLowerCase(adminAddress) == toLowerCase(msgSender);
};

const canBanNFT = async (address) => {
  let _isAdmin = isAdmin(address);
  if (_isAdmin) return true;
  let mod = await Moderator.findOne({ address: address });
  if (mod) return true;
  else return false;
};

router.post("/banUser", auth, async (req, res) => {
  try {
    let adminAddress = extractAddress(req, res);
    if (isAdmin(adminAddress)) {
      let banAddress = toLowerCase(req.body.address);
      let reason = req.body.reason;
      try {
        let bannedUser = new BannedUser();
        bannedUser.address = banAddress;
        bannedUser.reason = reason ? reason : "";
        await bannedUser.save();
        return res.json({
          status: "success",
          data: "banned",
        });
      } catch (error) {
        return res.json({
          status: "failed",
          data: "user is alread banned",
        });
      }
    } else {
      return res.json({
        status: "failed",
        data: "You are not an admin",
      });
    }
  } catch (error) {
    return res.status(400).json({
      status: "failed",
    });
  }
});

router.post("/banItem", auth, async (req, res) => {
  try {
    let adminAddress = extractAddress(req, res);
    let isModOrAdmin = await canBanNFT(adminAddress);
    if (!isModOrAdmin)
      return res.json({
        status: "failed",
        data: "Only Admin or Mods can ban NFT!",
      });
    let signature = req.body.signature;
    let isValidsignature = validateSignature(adminAddress, signature);
    if (!isValidsignature)
      return res.json({
        status: "failed",
        data: "Invalid Signature",
      });
    let address = toLowerCase(req.body.address);
    let tokenID = parseInt(req.body.tokenID);
    try {
      let bannedNFT = new BannedNFT();
      bannedNFT.contractAddress = address;
      bannedNFT.tokenID = tokenID;
      await bannedNFT.save();
      await NFTITEM.deleteOne({
        contractAddress: address,
        tokenID: tokenID,
      });
      await ERC1155HOLDING.deleteMany({
        contractAddress: address,
        tokenID: tokenID,
      });
      return res.json({
        status: "success",
        data: "banned",
      });
    } catch (error) {
      return res.json({
        status: "failed",
        data: "This Item is already banned",
      });
    }
  } catch (error) {
    return res.status(400).json({
      status: "failed",
    });
  }
});

router.post("/banItems", auth, async (req, res) => {
  try {
    let adminAddress = extractAddress(req, res);
    let isModOrAdmin = await canBanNFT(adminAddress);
    if (!isModOrAdmin)
      return res.json({
        status: "failed",
        data: "Only Admin or Mods can ban NFT!",
      });
    let signature = req.body.signature;
    let isValidsignature = validateSignature(adminAddress, signature);
    if (!isValidsignature)
      return res.json({
        status: "failed",
        data: "Invalid Signature",
      });

    let contractAddress = toLowerCase(req.body.address);
    let _tokenIDs = req.body.tokenIDs;
    _tokenIDs = _tokenIDs.split(" ,");
    let tokenIDs = [];
    _tokenIDs.map((tkID) => {
      tokenIDs.push(parseInt(tkID));
    });
    console.log("token IDs are ");
    console.log(tokenIDs);
    await NFTITEM.deleteMany({
      contractAddress: contractAddress,
      tokenID: { $in: tokenIDs },
    });
    await ERC1155HOLDING.deleteMany({
      contractAddress: contractAddress,
      tokenID: { $in: tokenIDs },
    });
    try {
      let data = [];
      tokenIDs.map((tkID) => {
        data.push({
          contractAddress: contractAddress,
          tokenID: tkID,
        });
      });
      BannedNFT.insertMany(data);
    } catch (error) {
      console.log("error in insert many banning multiple NFTs");
      console.log(error);
    }
    return res.json({
      status: "success",
      data: "banned",
    });
  } catch (error) {
    console.log(error);
    return res.json({
      status: "Failed to ban NFT Items!",
    });
  }
});

router.post("/boostCollection", auth, async (req, res) => {
  try {
    let adminAddress = extractAddress(req, res);
    if (isAdmin(adminAddress)) {
      let address = toLowerCase(req.body.address);
      try {
        let contract = await ERC721CONTRACT.findOne({
          address: address,
        });
        if (contract) {
          contract.isVerified = true;
          await contract.save();
          return res.json({
            status: "success",
            data: "collection boosted",
          });
        } else {
          return res.status(400).json({
            status: "failed",
          });
        }
      } catch (error) {
        return res.status(400).json({
          status: "failed",
        });
      }
    } else {
      return res.status(400).json({
        status: "failed",
      });
    }
  } catch (error) {
    return res.status(400).json({
      status: "failed",
    });
  }
});

module.exports = router;
