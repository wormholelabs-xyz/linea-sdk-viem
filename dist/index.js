"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  OnChainMessageStatus: () => import_linea_sdk_core12.OnChainMessageStatus,
  claimOnL1: () => claimOnL1,
  claimOnL2: () => claimOnL2,
  deposit: () => deposit,
  getBlockExtraData: () => getBlockExtraData,
  getL1ToL2MessageStatus: () => getL1ToL2MessageStatus,
  getL2ToL1MessageStatus: () => getL2ToL1MessageStatus,
  getMessageByMessageHash: () => getMessageByMessageHash,
  getMessageProof: () => getMessageProof,
  getMessageSentEvents: () => getMessageSentEvents,
  getMessagesByTransactionHash: () => getMessagesByTransactionHash,
  getTransactionReceiptByMessageHash: () => getTransactionReceiptByMessageHash,
  publicActionsL1: () => publicActionsL1,
  publicActionsL2: () => publicActionsL2,
  walletActionsL1: () => walletActionsL1,
  walletActionsL2: () => walletActionsL2,
  withdraw: () => withdraw
});
module.exports = __toCommonJS(index_exports);
var import_linea_sdk_core12 = require("@consensys/linea-sdk-core");

// src/actions/deposit.ts
var import_viem = require("viem");
var import_utils = require("viem/utils");
var import_actions = require("viem/actions");
var import_linea_sdk_core = require("@consensys/linea-sdk-core");
async function deposit(client, parameters) {
  const { account: account_ = client.account, l2Client, token, amount, data, to, fee, ...tx } = parameters;
  const account = account_ ? (0, import_utils.parseAccount)(account_) : client.account;
  if (!account) {
    throw new import_viem.BaseError("Account is required to send a transaction");
  }
  const l1ChainId = client.chain?.id;
  const l2ChainId = l2Client.chain?.id;
  if (!l1ChainId || !l2ChainId) {
    throw new import_viem.BaseError("No chain id found in l1 or l2 client");
  }
  const lineaRollupAddress = parameters.lineaRollupAddress ?? (0, import_linea_sdk_core.getContractsAddressesByChainId)(l1ChainId).messageService;
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? (0, import_linea_sdk_core.getContractsAddressesByChainId)(l2ChainId).messageService;
  const l1TokenBridgeAddress = parameters.l1TokenBridgeAddress ?? (0, import_linea_sdk_core.getContractsAddressesByChainId)(l1ChainId).tokenBridge;
  const l2TokenBridgeAddress = parameters.l2TokenBridgeAddress ?? (0, import_linea_sdk_core.getContractsAddressesByChainId)(l2ChainId).tokenBridge;
  if (token === import_viem.zeroAddress) {
    return depositETH(client, {
      l2Client,
      account,
      lineaRollupAddress,
      l2MessageServiceAddress,
      to,
      fee,
      amount,
      data: data ?? "0x",
      tx
    });
  }
  return depositERC20(client, {
    l2Client,
    account,
    lineaRollupAddress,
    l2MessageServiceAddress,
    l1TokenBridgeAddress,
    l2TokenBridgeAddress,
    l1ChainId,
    l2ChainId,
    token,
    to,
    fee,
    amount,
    tx
  });
}
async function estimateEthBridgingGasUsed(client, parameters) {
  const { account, recipient, amount, nextMessageNumber, l2MessageServiceAddress } = parameters;
  const messageHash = computeMessageHash(account, recipient, 0n, amount, nextMessageNumber, "0x");
  const storageSlot = computeMessageStorageSlot(messageHash);
  const stateOverride = createStateOverride(l2MessageServiceAddress, storageSlot);
  return (0, import_actions.estimateContractGas)(client, {
    address: l2MessageServiceAddress,
    abi: [
      {
        inputs: [
          { internalType: "address", name: "_from", type: "address" },
          { internalType: "address", name: "_to", type: "address" },
          { internalType: "uint256", name: "_fee", type: "uint256" },
          { internalType: "uint256", name: "_value", type: "uint256" },
          { internalType: "address payable", name: "_feeRecipient", type: "address" },
          { internalType: "bytes", name: "_calldata", type: "bytes" },
          { internalType: "uint256", name: "_nonce", type: "uint256" }
        ],
        name: "claimMessage",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      }
    ],
    functionName: "claimMessage",
    account,
    args: [account, recipient, 0n, amount, import_viem.zeroAddress, "0x", nextMessageNumber],
    stateOverride
  });
}
async function estimateERC20BridgingGasUsed(client, parameters) {
  const {
    l1Client,
    token,
    l1ChainId,
    l2ChainId,
    amount,
    recipient,
    nextMessageNumber,
    account,
    l2MessageServiceAddress,
    l1TokenBridgeAddress,
    l2TokenBridgeAddress
  } = parameters;
  const { tokenAddress, chainId, tokenMetadata } = await prepareERC20TokenParams(l1Client, {
    token,
    l1ChainId,
    l2ChainId
  });
  const encodedData = (0, import_viem.encodeFunctionData)({
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "_nativeToken",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "_amount",
            type: "uint256"
          },
          {
            internalType: "address",
            name: "_recipient",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "_chainId",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "_tokenMetadata",
            type: "bytes"
          }
        ],
        name: "completeBridging",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      }
    ],
    functionName: "completeBridging",
    args: [tokenAddress, amount, recipient, BigInt(chainId), tokenMetadata]
  });
  const messageHash = computeMessageHash(
    l1TokenBridgeAddress,
    l2TokenBridgeAddress,
    0n,
    0n,
    nextMessageNumber,
    encodedData
  );
  const storageSlot = computeMessageStorageSlot(messageHash);
  const stateOverride = createStateOverride(l2MessageServiceAddress, storageSlot);
  return (0, import_actions.estimateContractGas)(client, {
    address: l2MessageServiceAddress,
    abi: [
      {
        inputs: [
          { internalType: "address", name: "_from", type: "address" },
          { internalType: "address", name: "_to", type: "address" },
          { internalType: "uint256", name: "_fee", type: "uint256" },
          { internalType: "uint256", name: "_value", type: "uint256" },
          { internalType: "address payable", name: "_feeRecipient", type: "address" },
          { internalType: "bytes", name: "_calldata", type: "bytes" },
          { internalType: "uint256", name: "_nonce", type: "uint256" }
        ],
        name: "claimMessage",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      }
    ],
    functionName: "claimMessage",
    account,
    args: [l1TokenBridgeAddress, l2TokenBridgeAddress, 0n, 0n, import_viem.zeroAddress, encodedData, nextMessageNumber],
    stateOverride
  });
}
async function prepareERC20TokenParams(client, parameters) {
  const { token, l1ChainId, l2ChainId } = parameters;
  const [tokenNameResult, tokenSymbolResult, tokenDecimalsResult, nativeTokenResult] = await (0, import_actions.multicall)(client, {
    contracts: [
      {
        address: token,
        abi: import_viem.erc20Abi,
        functionName: "name"
      },
      {
        address: token,
        abi: import_viem.erc20Abi,
        functionName: "symbol"
      },
      {
        address: token,
        abi: import_viem.erc20Abi,
        functionName: "decimals"
      },
      {
        address: (0, import_linea_sdk_core.getContractsAddressesByChainId)(l1ChainId).tokenBridge,
        abi: [
          {
            inputs: [
              {
                internalType: "address",
                name: "bridged",
                type: "address"
              }
            ],
            name: "bridgedToNativeToken",
            outputs: [
              {
                internalType: "address",
                name: "native",
                type: "address"
              }
            ],
            stateMutability: "view",
            type: "function"
          }
        ],
        functionName: "bridgedToNativeToken",
        args: [token]
      }
    ],
    allowFailure: true
  });
  const tokenName = tokenNameResult.status === "success" ? tokenNameResult.result : "NO_NAME";
  const tokenSymbol = tokenSymbolResult.status === "success" ? tokenSymbolResult.result : "NO_SYMBOL";
  if (tokenDecimalsResult.status !== "success") {
    throw new import_viem.BaseError(`Failed to fetch token decimals for ${token}. Error: ${tokenDecimalsResult.error}`);
  }
  if (nativeTokenResult.status !== "success") {
    throw new import_viem.BaseError(`Failed to fetch native token for ${token}. Error: ${nativeTokenResult.error}`);
  }
  let tokenAddress = token;
  let chainId = l1ChainId;
  let tokenMetadata = (0, import_viem.encodeAbiParameters)(
    [
      { name: "tokenName", type: "string" },
      { name: "tokenSymbol", type: "string" },
      { name: "tokenDecimals", type: "uint8" }
    ],
    [tokenName, tokenSymbol, tokenDecimalsResult.result]
  );
  if (nativeTokenResult.result !== import_viem.zeroAddress) {
    tokenAddress = nativeTokenResult.result;
    chainId = l2ChainId;
    tokenMetadata = "0x";
  }
  return { tokenAddress, chainId, tokenMetadata };
}
function computeMessageHash(from, to, fee, value, nonce, calldata = "0x") {
  return (0, import_viem.keccak256)(
    (0, import_viem.encodeAbiParameters)(
      [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "fee", type: "uint256" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "calldata", type: "bytes" }
      ],
      [from, to, fee, value, nonce, calldata]
    )
  );
}
function computeMessageStorageSlot(messageHash) {
  return (0, import_viem.keccak256)(
    (0, import_viem.encodeAbiParameters)(
      [
        { name: "messageHash", type: "bytes32" },
        { name: "mappingSlot", type: "uint256" }
      ],
      [messageHash, 176n]
    )
  );
}
function createStateOverride(messageServiceAddress, storageSlot) {
  return [
    {
      address: messageServiceAddress,
      stateDiff: [
        {
          slot: storageSlot,
          value: "0x0000000000000000000000000000000000000000000000000000000000000001"
        }
      ]
    }
  ];
}
async function getNextMessageNumber(client, parameters) {
  const { lineaRollupAddress } = parameters;
  return (0, import_actions.readContract)(client, {
    address: lineaRollupAddress,
    abi: [
      {
        inputs: [],
        name: "nextMessageNumber",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256"
          }
        ],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: "nextMessageNumber"
  });
}
async function depositETH(client, parameters) {
  const {
    l2Client,
    account: account_,
    lineaRollupAddress,
    l2MessageServiceAddress,
    amount,
    to,
    data,
    fee,
    tx
  } = parameters;
  let bridgingFee = fee ?? 0n;
  if (fee === void 0) {
    const [nextMessageNumber, { baseFeePerGas }, { maxPriorityFeePerGas }] = await Promise.all([
      getNextMessageNumber(client, {
        lineaRollupAddress
      }),
      (0, import_actions.getBlock)(l2Client, { blockTag: "latest" }),
      (0, import_actions.estimateFeesPerGas)(l2Client, { type: "eip1559", chain: l2Client.chain })
    ]);
    const l2ClaimingTxGasLimit = await estimateEthBridgingGasUsed(l2Client, {
      account: account_.address,
      recipient: to,
      amount,
      nextMessageNumber,
      l2MessageServiceAddress
    });
    bridgingFee = (baseFeePerGas + maxPriorityFeePerGas) * (l2ClaimingTxGasLimit + 6000n);
  }
  return (0, import_actions.sendTransaction)(client, {
    to: lineaRollupAddress,
    value: amount + bridgingFee,
    account: account_,
    data: (0, import_viem.encodeFunctionData)({
      abi: [
        {
          inputs: [
            { internalType: "address", name: "_to", type: "address" },
            { internalType: "uint256", name: "_fee", type: "uint256" },
            { internalType: "bytes", name: "_calldata", type: "bytes" }
          ],
          name: "sendMessage",
          outputs: [],
          stateMutability: "payable",
          type: "function"
        }
      ],
      functionName: "sendMessage",
      args: [to, bridgingFee, data]
    }),
    ...tx
  });
}
async function depositERC20(client, parameters) {
  const {
    l2Client,
    account,
    l1TokenBridgeAddress,
    l2TokenBridgeAddress,
    lineaRollupAddress,
    l2MessageServiceAddress,
    l1ChainId,
    l2ChainId,
    token,
    to,
    fee,
    amount,
    tx
  } = parameters;
  let bridgingFee = fee ?? 0n;
  if (fee === void 0) {
    const [nextMessageNumber, { baseFeePerGas }, { maxPriorityFeePerGas }] = await Promise.all([
      getNextMessageNumber(client, {
        lineaRollupAddress
      }),
      (0, import_actions.getBlock)(l2Client, { blockTag: "latest" }),
      (0, import_actions.estimateFeesPerGas)(l2Client, { type: "eip1559", chain: l2Client.chain })
    ]);
    const l2ClaimingTxGasLimit = await estimateERC20BridgingGasUsed(l2Client, {
      l1Client: client,
      account: account.address,
      token,
      l1ChainId,
      l2ChainId,
      amount,
      recipient: to,
      nextMessageNumber,
      l2MessageServiceAddress,
      l1TokenBridgeAddress,
      l2TokenBridgeAddress
    });
    bridgingFee = (baseFeePerGas + maxPriorityFeePerGas) * (l2ClaimingTxGasLimit + 6000n);
  }
  const [tokenBalance, allowance] = await (0, import_actions.multicall)(client, {
    contracts: [
      {
        address: token,
        abi: import_viem.erc20Abi,
        functionName: "balanceOf",
        args: [account.address]
      },
      {
        address: token,
        abi: import_viem.erc20Abi,
        functionName: "allowance",
        args: [account.address, l1TokenBridgeAddress]
      }
    ],
    allowFailure: false
  });
  if (tokenBalance < amount) {
    throw new import_viem.BaseError(
      `Insufficient token balance for bridging. Current balance: ${tokenBalance}, required: ${amount}`
    );
  }
  if (allowance < amount) {
    const approveTxHash = await (0, import_actions.sendTransaction)(client, {
      to: token,
      account,
      data: (0, import_viem.encodeFunctionData)({
        abi: import_viem.erc20Abi,
        functionName: "approve",
        args: [l1TokenBridgeAddress, amount]
      })
    });
    await (0, import_actions.waitForTransactionReceipt)(client, {
      hash: approveTxHash
    });
  }
  return (0, import_actions.sendTransaction)(client, {
    to: l1TokenBridgeAddress,
    value: bridgingFee,
    account,
    data: (0, import_viem.encodeFunctionData)({
      abi: [
        {
          inputs: [
            {
              internalType: "address",
              name: "_token",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "_amount",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "_recipient",
              type: "address"
            }
          ],
          name: "bridgeToken",
          outputs: [],
          stateMutability: "payable",
          type: "function"
        }
      ],
      functionName: "bridgeToken",
      args: [token, amount, to]
    }),
    ...tx
  });
}

// src/actions/withdraw.ts
var import_viem2 = require("viem");
var import_utils2 = require("viem/utils");
var import_actions2 = require("viem/actions");
var import_linea_sdk_core2 = require("@consensys/linea-sdk-core");
async function withdraw(client, parameters) {
  const { account: account_ = client.account, token, amount, to, data, ...tx } = parameters;
  const account = account_ ? (0, import_utils2.parseAccount)(account_) : client.account;
  if (!account) {
    throw new import_viem2.BaseError("Account is required to send a transaction");
  }
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new import_viem2.BaseError("No chain id found");
  }
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? (0, import_linea_sdk_core2.getContractsAddressesByChainId)(chainId).messageService;
  const minimumFeeInWei = await (0, import_actions2.readContract)(client, {
    address: l2MessageServiceAddress,
    abi: [
      {
        inputs: [],
        name: "minimumFeeInWei",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: "minimumFeeInWei"
  });
  if (token === import_viem2.zeroAddress) {
    return (0, import_actions2.sendTransaction)(client, {
      to: l2MessageServiceAddress,
      value: amount + minimumFeeInWei,
      account,
      data: (0, import_viem2.encodeFunctionData)({
        abi: [
          {
            inputs: [
              { internalType: "address", name: "_to", type: "address" },
              { internalType: "uint256", name: "_fee", type: "uint256" },
              { internalType: "bytes", name: "_calldata", type: "bytes" }
            ],
            name: "sendMessage",
            outputs: [],
            stateMutability: "payable",
            type: "function"
          }
        ],
        functionName: "sendMessage",
        args: [to, minimumFeeInWei, data ?? "0x"]
      }),
      ...tx
    });
  }
  const tokenBridgeAddress = parameters.l2TokenBridgeAddress ?? (0, import_linea_sdk_core2.getContractsAddressesByChainId)(chainId).tokenBridge;
  return (0, import_actions2.sendTransaction)(client, {
    to: tokenBridgeAddress,
    value: minimumFeeInWei,
    account,
    data: (0, import_viem2.encodeFunctionData)({
      abi: [
        {
          inputs: [
            {
              internalType: "address",
              name: "_token",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "_amount",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "_recipient",
              type: "address"
            }
          ],
          name: "bridgeToken",
          outputs: [],
          stateMutability: "payable",
          type: "function"
        }
      ],
      functionName: "bridgeToken",
      args: [token, amount, to]
    }),
    ...tx
  });
}

// src/actions/getBlockExtraData.ts
var import_linea_sdk_core3 = require("@consensys/linea-sdk-core");
var import_actions3 = require("viem/actions");
async function getBlockExtraData(client, parameters) {
  const block = await (0, import_actions3.getBlock)(client, parameters);
  return (0, import_linea_sdk_core3.parseBlockExtraData)(block.extraData);
}

// src/actions/getL1ToL2MessageStatus.ts
var import_actions4 = require("viem/actions");
var import_linea_sdk_core4 = require("@consensys/linea-sdk-core");
async function getL1ToL2MessageStatus(client, parameters) {
  const { messageHash, l2MessageServiceAddress } = parameters;
  if (!client.chain) {
    throw new Error("Client chain is required to get L1 to L2 message status.");
  }
  const l2MessageService = l2MessageServiceAddress ?? (0, import_linea_sdk_core4.getContractsAddressesByChainId)(client.chain.id).messageService;
  const status = await (0, import_actions4.readContract)(client, {
    address: l2MessageService,
    abi: [
      {
        inputs: [{ internalType: "bytes32", name: "messageHash", type: "bytes32" }],
        name: "inboxL1L2MessageStatus",
        outputs: [{ internalType: "uint256", name: "messageStatus", type: "uint256" }],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: "inboxL1L2MessageStatus",
    args: [messageHash]
  });
  return (0, import_linea_sdk_core4.formatMessageStatus)(status);
}

// src/actions/getL2ToL1MessageStatus.ts
var import_viem3 = require("viem");
var import_actions6 = require("viem/actions");
var import_linea_sdk_core5 = require("@consensys/linea-sdk-core");

// src/actions/getMessageSentEvents.ts
var import_actions5 = require("viem/actions");
async function getMessageSentEvents(client, parameters) {
  const events = await (0, import_actions5.getContractEvents)(client, {
    address: parameters.address,
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: "address", name: "_from", type: "address" },
          { indexed: true, internalType: "address", name: "_to", type: "address" },
          { indexed: false, internalType: "uint256", name: "_fee", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "_value", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "_nonce", type: "uint256" },
          { indexed: false, internalType: "bytes", name: "_calldata", type: "bytes" },
          { indexed: true, internalType: "bytes32", name: "_messageHash", type: "bytes32" }
        ],
        name: "MessageSent",
        type: "event"
      }
    ],
    eventName: "MessageSent",
    args: parameters.args,
    fromBlock: parameters.fromBlock ?? "earliest",
    toBlock: parameters.toBlock ?? "latest"
  });
  return events.filter((event) => event.removed === false).map((event) => ({
    messageSender: event.args._from,
    destination: event.args._to,
    fee: event.args._fee,
    value: event.args._value,
    messageNonce: event.args._nonce,
    calldata: event.args._calldata,
    messageHash: event.args._messageHash,
    blockNumber: event.blockNumber,
    logIndex: event.logIndex,
    contractAddress: event.address,
    transactionHash: event.transactionHash
  }));
}

// src/actions/getL2ToL1MessageStatus.ts
async function getL2ToL1MessageStatus(client, parameters) {
  const { l2Client, messageHash, l2LogsBlockRange } = parameters;
  if (!client.chain) {
    throw new import_viem3.BaseError("Client is required to get L2 to L1 message status.");
  }
  if (!l2Client.chain) {
    throw new import_viem3.BaseError("L2 client is required to get L2 to L1 message status.");
  }
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? (0, import_linea_sdk_core5.getContractsAddressesByChainId)(l2Client.chain.id).messageService;
  const [messageSentEvent] = await getMessageSentEvents(l2Client, {
    args: { _messageHash: messageHash },
    address: l2MessageServiceAddress,
    fromBlock: l2LogsBlockRange?.fromBlock,
    toBlock: l2LogsBlockRange?.toBlock
  });
  if (!messageSentEvent) {
    throw new import_viem3.BaseError(`Message hash does not exist on L2. Message hash: ${messageHash}`);
  }
  const lineaRollupAddress = parameters.lineaRollupAddress ?? (0, import_linea_sdk_core5.getContractsAddressesByChainId)(client.chain.id).messageService;
  const [[l2MessagingBlockAnchoredEvent], isMessageClaimed] = await Promise.all([
    (0, import_actions6.getContractEvents)(client, {
      address: lineaRollupAddress,
      abi: [
        {
          anonymous: false,
          inputs: [{ indexed: true, internalType: "uint256", name: "l2Block", type: "uint256" }],
          name: "L2MessagingBlockAnchored",
          type: "event"
        }
      ],
      eventName: "L2MessagingBlockAnchored",
      args: {
        l2Block: messageSentEvent.blockNumber
      },
      fromBlock: "earliest",
      toBlock: "latest"
    }),
    (0, import_actions6.readContract)(client, {
      address: lineaRollupAddress,
      abi: [
        {
          inputs: [{ internalType: "uint256", name: "_messageNumber", type: "uint256" }],
          name: "isMessageClaimed",
          outputs: [{ internalType: "bool", name: "isClaimed", type: "bool" }],
          stateMutability: "view",
          type: "function"
        }
      ],
      functionName: "isMessageClaimed",
      args: [messageSentEvent.messageNonce]
    })
  ]);
  if (isMessageClaimed) {
    return import_linea_sdk_core5.OnChainMessageStatus.CLAIMED;
  }
  if (l2MessagingBlockAnchoredEvent) {
    return import_linea_sdk_core5.OnChainMessageStatus.CLAIMABLE;
  }
  return import_linea_sdk_core5.OnChainMessageStatus.UNKNOWN;
}

// src/actions/getMessageByMessageHash.ts
var import_viem4 = require("viem");
var import_actions7 = require("viem/actions");
var import_linea_sdk_core6 = require("@consensys/linea-sdk-core");
async function getMessageByMessageHash(client, parameters) {
  const { messageHash, messageServiceAddress } = parameters;
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new import_viem4.BaseError("No chain id found in client");
  }
  const [event] = await (0, import_actions7.getContractEvents)(client, {
    address: messageServiceAddress ?? (0, import_linea_sdk_core6.getContractsAddressesByChainId)(chainId).messageService,
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: "address", name: "_from", type: "address" },
          { indexed: true, internalType: "address", name: "_to", type: "address" },
          { indexed: false, internalType: "uint256", name: "_fee", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "_value", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "_nonce", type: "uint256" },
          { indexed: false, internalType: "bytes", name: "_calldata", type: "bytes" },
          { indexed: true, internalType: "bytes32", name: "_messageHash", type: "bytes32" }
        ],
        name: "MessageSent",
        type: "event"
      }
    ],
    eventName: "MessageSent",
    args: {
      _messageHash: messageHash
    },
    fromBlock: "earliest",
    toBlock: "latest"
  });
  if (!event) {
    throw new import_viem4.BaseError(`Message with hash ${messageHash} not found.`);
  }
  return {
    from: event.args._from,
    to: event.args._to,
    fee: event.args._fee,
    value: event.args._value,
    nonce: event.args._nonce,
    calldata: event.args._calldata,
    messageHash: event.args._messageHash,
    transactionHash: event.transactionHash,
    blockNumber: event.blockNumber
  };
}

// src/actions/getMessageProof.ts
var import_viem5 = require("viem");
var import_linea_sdk_core7 = require("@consensys/linea-sdk-core");
var import_actions8 = require("viem/actions");
async function getMessageProof(client, parameters) {
  const { l2Client, messageHash } = parameters;
  if (!l2Client.chain) {
    throw new import_viem5.BaseError("L2 client is required to get message proof.");
  }
  if (!client.chain) {
    throw new import_viem5.BaseError("L1 client is required to get message proof.");
  }
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? (0, import_linea_sdk_core7.getContractsAddressesByChainId)(l2Client.chain.id).messageService;
  const [messageSentEvent] = await getMessageSentEvents(l2Client, {
    address: l2MessageServiceAddress,
    args: { _messageHash: messageHash },
    fromBlock: parameters.l2LogsBlockRange?.fromBlock,
    toBlock: parameters.l2LogsBlockRange?.toBlock
  });
  if (!messageSentEvent) {
    throw new import_viem5.BaseError(`Message hash does not exist on L2. Message hash: ${messageHash}`);
  }
  const lineaRollupAddress = parameters.lineaRollupAddress ?? (0, import_linea_sdk_core7.getContractsAddressesByChainId)(client.chain.id).messageService;
  const [l2MessagingBlockAnchoredEvent] = await (0, import_actions8.getContractEvents)(client, {
    address: lineaRollupAddress,
    abi: [
      {
        anonymous: false,
        inputs: [{ indexed: true, internalType: "uint256", name: "l2Block", type: "uint256" }],
        name: "L2MessagingBlockAnchored",
        type: "event"
      }
    ],
    eventName: "L2MessagingBlockAnchored",
    args: {
      l2Block: messageSentEvent.blockNumber
    },
    fromBlock: "earliest",
    toBlock: "latest"
  });
  if (!l2MessagingBlockAnchoredEvent) {
    throw new import_viem5.BaseError(`L2 block number ${messageSentEvent.blockNumber} has not been finalized on L1.`);
  }
  const finalizationInfo = await getFinalizationMessagingInfo(client, {
    transactionHash: l2MessagingBlockAnchoredEvent.transactionHash,
    lineaRollupAddress
  });
  const l2MessageHashesInBlockRange = (await getMessageSentEvents(l2Client, {
    address: l2MessageServiceAddress,
    fromBlock: finalizationInfo.l2MessagingBlocksRange.startingBlock,
    toBlock: finalizationInfo.l2MessagingBlocksRange.endBlock
  })).map((event) => event.messageHash);
  if (l2MessageHashesInBlockRange.length === 0) {
    throw new import_viem5.BaseError(`No MessageSent events found in this block range on L2.`);
  }
  const l2messages = getMessageSiblings(messageHash, l2MessageHashesInBlockRange, finalizationInfo.treeDepth);
  const tree = new import_linea_sdk_core7.SparseMerkleTree(
    finalizationInfo.treeDepth,
    (left, right) => (0, import_viem5.keccak256)((0, import_viem5.encodePacked)(["bytes32", "bytes32"], [left, right]))
  );
  for (const [index, leaf] of l2messages.entries()) {
    tree.addLeaf(index, leaf);
  }
  if (!finalizationInfo.l2MerkleRoots.includes(tree.getRoot())) {
    throw new import_viem5.BaseError("Merkle tree build failed.");
  }
  return tree.getProof(l2messages.indexOf(messageHash));
}
async function getFinalizationMessagingInfo(client, parameters) {
  const receipt = await (0, import_actions8.getTransactionReceipt)(client, { hash: parameters.transactionHash });
  let treeDepth = 0;
  const l2MerkleRoots = [];
  const blocksNumber = [];
  const filteredLogs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === parameters.lineaRollupAddress.toLowerCase()
  );
  const parsedLogs = (0, import_viem5.parseEventLogs)({
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: "bytes32", name: "l2MerkleRoot", type: "bytes32" },
          { indexed: true, internalType: "uint256", name: "treeDepth", type: "uint256" }
        ],
        name: "L2MerkleRootAdded",
        type: "event"
      },
      {
        anonymous: false,
        inputs: [{ indexed: true, internalType: "uint256", name: "l2Block", type: "uint256" }],
        name: "L2MessagingBlockAnchored",
        type: "event"
      }
    ],
    eventName: ["L2MerkleRootAdded", "L2MessagingBlockAnchored"],
    logs: filteredLogs
  });
  for (const log of parsedLogs) {
    if (log.eventName === "L2MerkleRootAdded") {
      treeDepth = parseInt(log.args.treeDepth.toString());
      l2MerkleRoots.push(log.args.l2MerkleRoot);
    } else if (log.eventName === "L2MessagingBlockAnchored") {
      blocksNumber.push(parseInt(log.args.l2Block.toString()));
    }
  }
  if (l2MerkleRoots.length === 0) {
    throw new import_viem5.BaseError(`No L2MerkleRootAdded events found in this transaction.`);
  }
  if (blocksNumber.length === 0) {
    throw new import_viem5.BaseError(`No L2MessagingBlocksAnchored events found in this transaction.`);
  }
  return {
    l2MessagingBlocksRange: {
      startingBlock: BigInt(Math.min(...blocksNumber)),
      endBlock: BigInt(Math.max(...blocksNumber))
    },
    l2MerkleRoots,
    treeDepth
  };
}
function getMessageSiblings(messageHash, messageHashes, treeDepth) {
  const numberOfMessagesInTrees = 2 ** treeDepth;
  const messageHashesLength = messageHashes.length;
  const messageHashIndex = messageHashes.indexOf(messageHash);
  if (messageHashIndex === -1) {
    throw new import_viem5.BaseError("Message hash not found in messages.");
  }
  const start = Math.floor(messageHashIndex / numberOfMessagesInTrees) * numberOfMessagesInTrees;
  const end = Math.min(messageHashesLength, start + numberOfMessagesInTrees);
  const siblings = messageHashes.slice(start, end);
  const remainder = siblings.length % numberOfMessagesInTrees;
  if (remainder !== 0) {
    siblings.push(...Array(numberOfMessagesInTrees - remainder).fill(import_viem5.zeroHash));
  }
  return siblings;
}

// src/actions/getMessagesByTransactionHash.ts
var import_viem6 = require("viem");
var import_actions9 = require("viem/actions");
var import_linea_sdk_core8 = require("@consensys/linea-sdk-core");
async function getMessagesByTransactionHash(client, parameters) {
  const { transactionHash } = parameters;
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new import_viem6.BaseError("No chain id found in client");
  }
  const receipt = await (0, import_actions9.getTransactionReceipt)(client, { hash: transactionHash });
  const messageServiceAddress = parameters.messageServiceAddress ? parameters.messageServiceAddress.toLowerCase() : (0, import_linea_sdk_core8.getContractsAddressesByChainId)(chainId).messageService.toLowerCase();
  const logs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === messageServiceAddress && log.topics[0]?.toLowerCase() === (0, import_viem6.toEventSelector)("MessageSent(address,address,uint256,uint256,uint256,bytes,bytes32)").toLowerCase()
  );
  const parsedLogs = (0, import_viem6.parseEventLogs)({
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: "address", name: "_from", type: "address" },
          { indexed: true, internalType: "address", name: "_to", type: "address" },
          { indexed: false, internalType: "uint256", name: "_fee", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "_value", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "_nonce", type: "uint256" },
          { indexed: false, internalType: "bytes", name: "_calldata", type: "bytes" },
          { indexed: true, internalType: "bytes32", name: "_messageHash", type: "bytes32" }
        ],
        name: "MessageSent",
        type: "event"
      }
    ],
    eventName: "MessageSent",
    logs
  });
  return parsedLogs.map((log) => ({
    from: log.args._from,
    to: log.args._to,
    fee: log.args._fee,
    value: log.args._value,
    nonce: log.args._nonce,
    calldata: log.args._calldata,
    messageHash: log.args._messageHash,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber
  }));
}

// src/actions/getTransactionReceiptByMessageHash.ts
var import_viem7 = require("viem");
var import_actions10 = require("viem/actions");
var import_linea_sdk_core9 = require("@consensys/linea-sdk-core");
async function getTransactionReceiptByMessageHash(client, parameters) {
  const { messageHash, messageServiceAddress } = parameters;
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new import_viem7.BaseError("No chain id found in client");
  }
  const [event] = await (0, import_actions10.getContractEvents)(client, {
    address: messageServiceAddress ?? (0, import_linea_sdk_core9.getContractsAddressesByChainId)(chainId).messageService,
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: "address", name: "_from", type: "address" },
          { indexed: true, internalType: "address", name: "_to", type: "address" },
          { indexed: false, internalType: "uint256", name: "_fee", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "_value", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "_nonce", type: "uint256" },
          { indexed: false, internalType: "bytes", name: "_calldata", type: "bytes" },
          { indexed: true, internalType: "bytes32", name: "_messageHash", type: "bytes32" }
        ],
        name: "MessageSent",
        type: "event"
      }
    ],
    eventName: "MessageSent",
    args: {
      _messageHash: messageHash
    },
    fromBlock: "earliest",
    toBlock: "latest"
  });
  if (!event) {
    throw new import_viem7.BaseError(`Message with hash ${messageHash} not found.`);
  }
  const receipt = await (0, import_actions10.getTransactionReceipt)(client, { hash: event.transactionHash });
  return receipt;
}

// src/actions/claimOnL1.ts
var import_viem8 = require("viem");
var import_utils3 = require("viem/utils");
var import_actions11 = require("viem/actions");
var import_linea_sdk_core10 = require("@consensys/linea-sdk-core");
async function claimOnL1(client, parameters) {
  const {
    account: account_ = client.account,
    from,
    to,
    fee,
    value,
    messageNonce,
    calldata,
    feeRecipient,
    messageProof,
    ...tx
  } = parameters;
  const account = account_ ? (0, import_utils3.parseAccount)(account_) : client.account;
  if (!account) {
    throw new import_viem8.BaseError("Account is required to send a transaction");
  }
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new import_viem8.BaseError("No chain id found in l1 client");
  }
  const lineaRollupAddress = parameters.lineaRollupAddress ?? (0, import_linea_sdk_core10.getContractsAddressesByChainId)(chainId).messageService;
  return (0, import_actions11.sendTransaction)(client, {
    to: lineaRollupAddress,
    account,
    data: (0, import_viem8.encodeFunctionData)({
      abi: [
        {
          inputs: [
            {
              components: [
                { internalType: "bytes32[]", name: "proof", type: "bytes32[]" },
                { internalType: "uint256", name: "messageNumber", type: "uint256" },
                { internalType: "uint32", name: "leafIndex", type: "uint32" },
                { internalType: "address", name: "from", type: "address" },
                { internalType: "address", name: "to", type: "address" },
                { internalType: "uint256", name: "fee", type: "uint256" },
                { internalType: "uint256", name: "value", type: "uint256" },
                { internalType: "address payable", name: "feeRecipient", type: "address" },
                { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
                { internalType: "bytes", name: "data", type: "bytes" }
              ],
              internalType: "struct IL1MessageService.ClaimMessageWithProofParams",
              name: "_params",
              type: "tuple"
            }
          ],
          name: "claimMessageWithProof",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function"
        }
      ],
      functionName: "claimMessageWithProof",
      args: [
        {
          from,
          to,
          fee,
          value,
          feeRecipient: feeRecipient ?? import_viem8.zeroAddress,
          data: calldata,
          messageNumber: messageNonce,
          merkleRoot: messageProof.root,
          proof: messageProof.proof,
          leafIndex: messageProof.leafIndex
        }
      ]
    }),
    ...tx
  });
}

// src/actions/claimOnL2.ts
var import_viem9 = require("viem");
var import_utils4 = require("viem/utils");
var import_actions12 = require("viem/actions");
var import_linea_sdk_core11 = require("@consensys/linea-sdk-core");
async function claimOnL2(client, parameters) {
  const {
    account: account_ = client.account,
    from,
    to,
    fee,
    value,
    messageNonce,
    calldata,
    feeRecipient,
    ...tx
  } = parameters;
  const account = account_ ? (0, import_utils4.parseAccount)(account_) : client.account;
  if (!account) {
    throw new import_viem9.BaseError("Account is required to send a transaction");
  }
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new import_viem9.BaseError("No chain id found in l2 client");
  }
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? (0, import_linea_sdk_core11.getContractsAddressesByChainId)(chainId).messageService;
  return (0, import_actions12.sendTransaction)(client, {
    to: l2MessageServiceAddress,
    account,
    data: (0, import_viem9.encodeFunctionData)({
      abi: [
        {
          inputs: [
            {
              internalType: "address",
              name: "_from",
              type: "address"
            },
            {
              internalType: "address",
              name: "_to",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "_fee",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "_value",
              type: "uint256"
            },
            {
              internalType: "address payable",
              name: "_feeRecipient",
              type: "address"
            },
            {
              internalType: "bytes",
              name: "_calldata",
              type: "bytes"
            },
            {
              internalType: "uint256",
              name: "_nonce",
              type: "uint256"
            }
          ],
          name: "claimMessage",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function"
        }
      ],
      functionName: "claimMessage",
      args: [from, to, fee, value, feeRecipient ?? import_viem9.zeroAddress, calldata, messageNonce]
    }),
    ...tx
  });
}

// src/decorators/publicL1.ts
function publicActionsL1(parameters) {
  return (client) => ({
    getMessageProof: (args) => getMessageProof(client, {
      ...args,
      ...parameters ? {
        lineaRollupAddress: parameters.lineaRollupAddress,
        l2MessageServiceAddress: parameters.l2MessageServiceAddress
      } : {}
    }),
    getL2ToL1MessageStatus: (args) => getL2ToL1MessageStatus(client, {
      ...args,
      ...parameters ? {
        lineaRollupAddress: parameters.lineaRollupAddress,
        l2MessageServiceAddress: parameters.l2MessageServiceAddress
      } : {}
    }),
    getMessageByMessageHash: (args) => getMessageByMessageHash(client, {
      ...args,
      ...parameters ? {
        messageServiceAddress: parameters.lineaRollupAddress
      } : {}
    }),
    getMessagesByTransactionHash: (args) => getMessagesByTransactionHash(client, {
      ...args,
      ...parameters ? {
        messageServiceAddress: parameters.lineaRollupAddress
      } : {}
    }),
    getTransactionReceiptByMessageHash: (args) => getTransactionReceiptByMessageHash(client, {
      ...args,
      ...parameters ? {
        messageServiceAddress: parameters.lineaRollupAddress
      } : {}
    })
  });
}

// src/decorators/publicL2.ts
function publicActionsL2(parameters) {
  return (client) => ({
    getBlockExtraData: (args) => getBlockExtraData(client, args),
    getL1ToL2MessageStatus: (args) => getL1ToL2MessageStatus(client, {
      ...args,
      ...parameters ? { l2MessageServiceAddress: parameters.l2MessageServiceAddress } : {}
    }),
    getMessageByMessageHash: (args) => getMessageByMessageHash(client, {
      ...args,
      ...parameters ? { messageServiceAddress: parameters.l2MessageServiceAddress } : {}
    }),
    getMessagesByTransactionHash: (args) => getMessagesByTransactionHash(client, {
      ...args,
      ...parameters ? { messageServiceAddress: parameters.l2MessageServiceAddress } : {}
    }),
    getTransactionReceiptByMessageHash: (args) => getTransactionReceiptByMessageHash(client, {
      ...args,
      ...parameters ? { messageServiceAddress: parameters.l2MessageServiceAddress } : {}
    })
  });
}

// src/decorators/walletL1.ts
function walletActionsL1(parameters) {
  return (client) => ({
    deposit: (args) => deposit(client, {
      ...args,
      ...parameters ? {
        lineaRollupAddress: parameters.lineaRollupAddress,
        l2MessageServiceAddress: parameters.l2MessageServiceAddress,
        l1TokenBridgeAddress: parameters.l1TokenBridgeAddress,
        l2TokenBridgeAddress: parameters.l2TokenBridgeAddress
      } : {}
    }),
    claimOnL1: (args) => claimOnL1(client, { ...args, ...parameters ? { lineaRollupAddress: parameters.lineaRollupAddress } : {} })
  });
}

// src/decorators/walletL2.ts
function walletActionsL2(parameters) {
  return (client) => ({
    withdraw: (args) => withdraw(client, {
      ...args,
      ...parameters ? {
        l2MessageServiceAddress: parameters.l2MessageServiceAddress,
        l2TokenBridgeAddress: parameters.l2TokenBridgeAddress
      } : {}
    }),
    claimOnL2: (args) => claimOnL2(client, {
      ...args,
      ...parameters ? { l2MessageServiceAddress: parameters.l2MessageServiceAddress } : {}
    })
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OnChainMessageStatus,
  claimOnL1,
  claimOnL2,
  deposit,
  getBlockExtraData,
  getL1ToL2MessageStatus,
  getL2ToL1MessageStatus,
  getMessageByMessageHash,
  getMessageProof,
  getMessageSentEvents,
  getMessagesByTransactionHash,
  getTransactionReceiptByMessageHash,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
  walletActionsL2,
  withdraw
});
//# sourceMappingURL=index.js.map