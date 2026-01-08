// src/index.ts
import { OnChainMessageStatus as OnChainMessageStatus3 } from "@consensys/linea-sdk-core";

// src/actions/deposit.ts
import {
  BaseError,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  keccak256,
  zeroAddress
} from "viem";
import { parseAccount } from "viem/utils";
import {
  estimateContractGas,
  estimateFeesPerGas,
  getBlock,
  multicall,
  readContract,
  sendTransaction,
  waitForTransactionReceipt
} from "viem/actions";
import { getContractsAddressesByChainId } from "@consensys/linea-sdk-core";
async function deposit(client, parameters) {
  const { account: account_ = client.account, l2Client, token, amount, data, to, fee, ...tx } = parameters;
  const account = account_ ? parseAccount(account_) : client.account;
  if (!account) {
    throw new BaseError("Account is required to send a transaction");
  }
  const l1ChainId = client.chain?.id;
  const l2ChainId = l2Client.chain?.id;
  if (!l1ChainId || !l2ChainId) {
    throw new BaseError("No chain id found in l1 or l2 client");
  }
  const lineaRollupAddress = parameters.lineaRollupAddress ?? getContractsAddressesByChainId(l1ChainId).messageService;
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? getContractsAddressesByChainId(l2ChainId).messageService;
  const l1TokenBridgeAddress = parameters.l1TokenBridgeAddress ?? getContractsAddressesByChainId(l1ChainId).tokenBridge;
  const l2TokenBridgeAddress = parameters.l2TokenBridgeAddress ?? getContractsAddressesByChainId(l2ChainId).tokenBridge;
  if (token === zeroAddress) {
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
  return estimateContractGas(client, {
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
    args: [account, recipient, 0n, amount, zeroAddress, "0x", nextMessageNumber],
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
  const encodedData = encodeFunctionData({
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
  return estimateContractGas(client, {
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
    args: [l1TokenBridgeAddress, l2TokenBridgeAddress, 0n, 0n, zeroAddress, encodedData, nextMessageNumber],
    stateOverride
  });
}
async function prepareERC20TokenParams(client, parameters) {
  const { token, l1ChainId, l2ChainId } = parameters;
  const [tokenNameResult, tokenSymbolResult, tokenDecimalsResult, nativeTokenResult] = await multicall(client, {
    contracts: [
      {
        address: token,
        abi: erc20Abi,
        functionName: "name"
      },
      {
        address: token,
        abi: erc20Abi,
        functionName: "symbol"
      },
      {
        address: token,
        abi: erc20Abi,
        functionName: "decimals"
      },
      {
        address: getContractsAddressesByChainId(l1ChainId).tokenBridge,
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
    throw new BaseError(`Failed to fetch token decimals for ${token}. Error: ${tokenDecimalsResult.error}`);
  }
  if (nativeTokenResult.status !== "success") {
    throw new BaseError(`Failed to fetch native token for ${token}. Error: ${nativeTokenResult.error}`);
  }
  let tokenAddress = token;
  let chainId = l1ChainId;
  let tokenMetadata = encodeAbiParameters(
    [
      { name: "tokenName", type: "string" },
      { name: "tokenSymbol", type: "string" },
      { name: "tokenDecimals", type: "uint8" }
    ],
    [tokenName, tokenSymbol, tokenDecimalsResult.result]
  );
  if (nativeTokenResult.result !== zeroAddress) {
    tokenAddress = nativeTokenResult.result;
    chainId = l2ChainId;
    tokenMetadata = "0x";
  }
  return { tokenAddress, chainId, tokenMetadata };
}
function computeMessageHash(from, to, fee, value, nonce, calldata = "0x") {
  return keccak256(
    encodeAbiParameters(
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
  return keccak256(
    encodeAbiParameters(
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
  return readContract(client, {
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
      getBlock(l2Client, { blockTag: "latest" }),
      estimateFeesPerGas(l2Client, { type: "eip1559", chain: l2Client.chain })
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
  return sendTransaction(client, {
    to: lineaRollupAddress,
    value: amount + bridgingFee,
    account: account_,
    data: encodeFunctionData({
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
      getBlock(l2Client, { blockTag: "latest" }),
      estimateFeesPerGas(l2Client, { type: "eip1559", chain: l2Client.chain })
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
  const [tokenBalance, allowance] = await multicall(client, {
    contracts: [
      {
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address]
      },
      {
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account.address, l1TokenBridgeAddress]
      }
    ],
    allowFailure: false
  });
  if (tokenBalance < amount) {
    throw new BaseError(
      `Insufficient token balance for bridging. Current balance: ${tokenBalance}, required: ${amount}`
    );
  }
  if (allowance < amount) {
    const approveTxHash = await sendTransaction(client, {
      to: token,
      account,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [l1TokenBridgeAddress, amount]
      })
    });
    await waitForTransactionReceipt(client, {
      hash: approveTxHash
    });
  }
  return sendTransaction(client, {
    to: l1TokenBridgeAddress,
    value: bridgingFee,
    account,
    data: encodeFunctionData({
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
import {
  BaseError as BaseError2,
  encodeFunctionData as encodeFunctionData2,
  zeroAddress as zeroAddress2
} from "viem";
import { parseAccount as parseAccount2 } from "viem/utils";
import { readContract as readContract2, sendTransaction as sendTransaction2 } from "viem/actions";
import { getContractsAddressesByChainId as getContractsAddressesByChainId2 } from "@consensys/linea-sdk-core";
async function withdraw(client, parameters) {
  const { account: account_ = client.account, token, amount, to, data, ...tx } = parameters;
  const account = account_ ? parseAccount2(account_) : client.account;
  if (!account) {
    throw new BaseError2("Account is required to send a transaction");
  }
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new BaseError2("No chain id found");
  }
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? getContractsAddressesByChainId2(chainId).messageService;
  const minimumFeeInWei = await readContract2(client, {
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
  if (token === zeroAddress2) {
    return sendTransaction2(client, {
      to: l2MessageServiceAddress,
      value: amount + minimumFeeInWei,
      account,
      data: encodeFunctionData2({
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
  const tokenBridgeAddress = parameters.l2TokenBridgeAddress ?? getContractsAddressesByChainId2(chainId).tokenBridge;
  return sendTransaction2(client, {
    to: tokenBridgeAddress,
    value: minimumFeeInWei,
    account,
    data: encodeFunctionData2({
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
import { parseBlockExtraData } from "@consensys/linea-sdk-core";
import { getBlock as getBlock2 } from "viem/actions";
async function getBlockExtraData(client, parameters) {
  const block = await getBlock2(client, parameters);
  return parseBlockExtraData(block.extraData);
}

// src/actions/getL1ToL2MessageStatus.ts
import { readContract as readContract3 } from "viem/actions";
import { formatMessageStatus, getContractsAddressesByChainId as getContractsAddressesByChainId3 } from "@consensys/linea-sdk-core";
async function getL1ToL2MessageStatus(client, parameters) {
  const { messageHash, l2MessageServiceAddress } = parameters;
  if (!client.chain) {
    throw new Error("Client chain is required to get L1 to L2 message status.");
  }
  const l2MessageService = l2MessageServiceAddress ?? getContractsAddressesByChainId3(client.chain.id).messageService;
  const status = await readContract3(client, {
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
  return formatMessageStatus(status);
}

// src/actions/getL2ToL1MessageStatus.ts
import {
  BaseError as BaseError3
} from "viem";
import { getContractEvents as getContractEvents2, readContract as readContract4 } from "viem/actions";
import { getContractsAddressesByChainId as getContractsAddressesByChainId4, OnChainMessageStatus as OnChainMessageStatus2 } from "@consensys/linea-sdk-core";

// src/actions/getMessageSentEvents.ts
import { getContractEvents } from "viem/actions";
async function getMessageSentEvents(client, parameters) {
  const events = await getContractEvents(client, {
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
    throw new BaseError3("Client is required to get L2 to L1 message status.");
  }
  if (!l2Client.chain) {
    throw new BaseError3("L2 client is required to get L2 to L1 message status.");
  }
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? getContractsAddressesByChainId4(l2Client.chain.id).messageService;
  const [messageSentEvent] = await getMessageSentEvents(l2Client, {
    args: { _messageHash: messageHash },
    address: l2MessageServiceAddress,
    fromBlock: l2LogsBlockRange?.fromBlock,
    toBlock: l2LogsBlockRange?.toBlock
  });
  if (!messageSentEvent) {
    throw new BaseError3(`Message hash does not exist on L2. Message hash: ${messageHash}`);
  }
  const lineaRollupAddress = parameters.lineaRollupAddress ?? getContractsAddressesByChainId4(client.chain.id).messageService;
  const [[l2MessagingBlockAnchoredEvent], isMessageClaimed] = await Promise.all([
    getContractEvents2(client, {
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
    readContract4(client, {
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
    return OnChainMessageStatus2.CLAIMED;
  }
  if (l2MessagingBlockAnchoredEvent) {
    return OnChainMessageStatus2.CLAIMABLE;
  }
  return OnChainMessageStatus2.UNKNOWN;
}

// src/actions/getMessageByMessageHash.ts
import { BaseError as BaseError4 } from "viem";
import { getContractEvents as getContractEvents3 } from "viem/actions";
import { getContractsAddressesByChainId as getContractsAddressesByChainId5 } from "@consensys/linea-sdk-core";
async function getMessageByMessageHash(client, parameters) {
  const { messageHash, messageServiceAddress } = parameters;
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new BaseError4("No chain id found in client");
  }
  const [event] = await getContractEvents3(client, {
    address: messageServiceAddress ?? getContractsAddressesByChainId5(chainId).messageService,
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
    throw new BaseError4(`Message with hash ${messageHash} not found.`);
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
import {
  BaseError as BaseError5,
  encodePacked,
  keccak256 as keccak2562,
  parseEventLogs,
  zeroHash
} from "viem";
import { getContractsAddressesByChainId as getContractsAddressesByChainId6, SparseMerkleTree } from "@consensys/linea-sdk-core";
import { getContractEvents as getContractEvents4, getTransactionReceipt } from "viem/actions";
async function getMessageProof(client, parameters) {
  const { l2Client, messageHash } = parameters;
  if (!l2Client.chain) {
    throw new BaseError5("L2 client is required to get message proof.");
  }
  if (!client.chain) {
    throw new BaseError5("L1 client is required to get message proof.");
  }
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? getContractsAddressesByChainId6(l2Client.chain.id).messageService;
  const [messageSentEvent] = await getMessageSentEvents(l2Client, {
    address: l2MessageServiceAddress,
    args: { _messageHash: messageHash },
    fromBlock: parameters.l2LogsBlockRange?.fromBlock,
    toBlock: parameters.l2LogsBlockRange?.toBlock
  });
  if (!messageSentEvent) {
    throw new BaseError5(`Message hash does not exist on L2. Message hash: ${messageHash}`);
  }
  const lineaRollupAddress = parameters.lineaRollupAddress ?? getContractsAddressesByChainId6(client.chain.id).messageService;
  const [l2MessagingBlockAnchoredEvent] = await getContractEvents4(client, {
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
    throw new BaseError5(`L2 block number ${messageSentEvent.blockNumber} has not been finalized on L1.`);
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
    throw new BaseError5(`No MessageSent events found in this block range on L2.`);
  }
  const l2messages = getMessageSiblings(messageHash, l2MessageHashesInBlockRange, finalizationInfo.treeDepth);
  const tree = new SparseMerkleTree(
    finalizationInfo.treeDepth,
    (left, right) => keccak2562(encodePacked(["bytes32", "bytes32"], [left, right]))
  );
  for (const [index, leaf] of l2messages.entries()) {
    tree.addLeaf(index, leaf);
  }
  if (!finalizationInfo.l2MerkleRoots.includes(tree.getRoot())) {
    throw new BaseError5("Merkle tree build failed.");
  }
  return tree.getProof(l2messages.indexOf(messageHash));
}
async function getFinalizationMessagingInfo(client, parameters) {
  const receipt = await getTransactionReceipt(client, { hash: parameters.transactionHash });
  let treeDepth = 0;
  const l2MerkleRoots = [];
  const blocksNumber = [];
  const filteredLogs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === parameters.lineaRollupAddress.toLowerCase()
  );
  const parsedLogs = parseEventLogs({
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
    throw new BaseError5(`No L2MerkleRootAdded events found in this transaction.`);
  }
  if (blocksNumber.length === 0) {
    throw new BaseError5(`No L2MessagingBlocksAnchored events found in this transaction.`);
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
    throw new BaseError5("Message hash not found in messages.");
  }
  const start = Math.floor(messageHashIndex / numberOfMessagesInTrees) * numberOfMessagesInTrees;
  const end = Math.min(messageHashesLength, start + numberOfMessagesInTrees);
  const siblings = messageHashes.slice(start, end);
  const remainder = siblings.length % numberOfMessagesInTrees;
  if (remainder !== 0) {
    siblings.push(...Array(numberOfMessagesInTrees - remainder).fill(zeroHash));
  }
  return siblings;
}

// src/actions/getMessagesByTransactionHash.ts
import { BaseError as BaseError6, parseEventLogs as parseEventLogs2, toEventSelector } from "viem";
import { getTransactionReceipt as getTransactionReceipt2 } from "viem/actions";
import { getContractsAddressesByChainId as getContractsAddressesByChainId7 } from "@consensys/linea-sdk-core";
async function getMessagesByTransactionHash(client, parameters) {
  const { transactionHash } = parameters;
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new BaseError6("No chain id found in client");
  }
  const receipt = await getTransactionReceipt2(client, { hash: transactionHash });
  const messageServiceAddress = parameters.messageServiceAddress ? parameters.messageServiceAddress.toLowerCase() : getContractsAddressesByChainId7(chainId).messageService.toLowerCase();
  const logs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === messageServiceAddress && log.topics[0]?.toLowerCase() === toEventSelector("MessageSent(address,address,uint256,uint256,uint256,bytes,bytes32)").toLowerCase()
  );
  const parsedLogs = parseEventLogs2({
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
import { BaseError as BaseError7 } from "viem";
import { getContractEvents as getContractEvents5, getTransactionReceipt as getTransactionReceipt3 } from "viem/actions";
import { getContractsAddressesByChainId as getContractsAddressesByChainId8 } from "@consensys/linea-sdk-core";
async function getTransactionReceiptByMessageHash(client, parameters) {
  const { messageHash, messageServiceAddress } = parameters;
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new BaseError7("No chain id found in client");
  }
  const [event] = await getContractEvents5(client, {
    address: messageServiceAddress ?? getContractsAddressesByChainId8(chainId).messageService,
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
    throw new BaseError7(`Message with hash ${messageHash} not found.`);
  }
  const receipt = await getTransactionReceipt3(client, { hash: event.transactionHash });
  return receipt;
}

// src/actions/claimOnL1.ts
import {
  BaseError as BaseError8,
  encodeFunctionData as encodeFunctionData3,
  zeroAddress as zeroAddress3
} from "viem";
import { parseAccount as parseAccount3 } from "viem/utils";
import { sendTransaction as sendTransaction3 } from "viem/actions";
import { getContractsAddressesByChainId as getContractsAddressesByChainId9 } from "@consensys/linea-sdk-core";
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
  const account = account_ ? parseAccount3(account_) : client.account;
  if (!account) {
    throw new BaseError8("Account is required to send a transaction");
  }
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new BaseError8("No chain id found in l1 client");
  }
  const lineaRollupAddress = parameters.lineaRollupAddress ?? getContractsAddressesByChainId9(chainId).messageService;
  return sendTransaction3(client, {
    to: lineaRollupAddress,
    account,
    data: encodeFunctionData3({
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
          feeRecipient: feeRecipient ?? zeroAddress3,
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
import {
  BaseError as BaseError9,
  encodeFunctionData as encodeFunctionData4,
  zeroAddress as zeroAddress4
} from "viem";
import { parseAccount as parseAccount4 } from "viem/utils";
import { sendTransaction as sendTransaction4 } from "viem/actions";
import { getContractsAddressesByChainId as getContractsAddressesByChainId10 } from "@consensys/linea-sdk-core";
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
  const account = account_ ? parseAccount4(account_) : client.account;
  if (!account) {
    throw new BaseError9("Account is required to send a transaction");
  }
  const chainId = client.chain?.id;
  if (!chainId) {
    throw new BaseError9("No chain id found in l2 client");
  }
  const l2MessageServiceAddress = parameters.l2MessageServiceAddress ?? getContractsAddressesByChainId10(chainId).messageService;
  return sendTransaction4(client, {
    to: l2MessageServiceAddress,
    account,
    data: encodeFunctionData4({
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
      args: [from, to, fee, value, feeRecipient ?? zeroAddress4, calldata, messageNonce]
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
export {
  OnChainMessageStatus3 as OnChainMessageStatus,
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
};
//# sourceMappingURL=index.mjs.map