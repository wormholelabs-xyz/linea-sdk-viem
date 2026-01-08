import { OnChainMessageStatus, MessageProof, ExtendedMessage, Message, L1PublicClient, L2PublicClient, L1WalletClient, L2WalletClient } from '@consensys/linea-sdk-core';
export { Message, MessageProof, OnChainMessageStatus } from '@consensys/linea-sdk-core';
import { Account, Address, MaybeRequired, IsUndefined, Chain, DeriveChain, Client, Transport, FormattedTransactionRequest, GetChainParameter, Hex, SendTransactionReturnType, BlockTag, GetBlockParameters, Prettify, Abi, ContractEventName, BlockNumber, GetContractEventsParameters, Hash, GetTransactionReceiptReturnType } from 'viem';

type GetAccountParameter<account extends Account | undefined = Account | undefined, accountOverride extends Account | Address | undefined = Account | Address, required extends boolean = true, nullish extends boolean = false> = MaybeRequired<{
    account?: accountOverride | Account | Address | (nullish extends true ? null : never) | undefined;
}, IsUndefined<account> extends true ? (required extends true ? true : false) : false>;

type DepositParameters<chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined, chainOverride extends Chain | undefined = Chain | undefined, chainL2 extends Chain | undefined = Chain | undefined, accountL2 extends Account | undefined = Account | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>> = Omit<FormattedTransactionRequest<derivedChain>, "data" | "to" | "from"> & Partial<GetChainParameter<chain, chainOverride>> & Partial<GetAccountParameter<account>> & {
    l2Client: Client<Transport, chainL2, accountL2>;
    token: Address;
    to: Address;
    fee?: bigint;
    amount: bigint;
    data?: Hex;
    lineaRollupAddress?: Address;
    l2MessageServiceAddress?: Address;
    l1TokenBridgeAddress?: Address;
    l2TokenBridgeAddress?: Address;
};
type DepositReturnType = SendTransactionReturnType;
declare function deposit<chain extends Chain | undefined, account extends Account | undefined, chainOverride extends Chain | undefined = Chain | undefined, chainL2 extends Chain | undefined = Chain | undefined, accountL2 extends Account | undefined = Account | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>>(client: Client<Transport, chain, account>, parameters: DepositParameters<chain, account, chainOverride, chainL2, accountL2, derivedChain>): Promise<DepositReturnType>;

type WithdrawParameters<chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined, chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>> = Omit<FormattedTransactionRequest<derivedChain>, "data" | "to" | "from"> & Partial<GetChainParameter<chain, chainOverride>> & Partial<GetAccountParameter<account>> & {
    token: Address;
    to: Address;
    amount: bigint;
    data?: Hex;
    l2MessageServiceAddress?: Address;
    l2TokenBridgeAddress?: Address;
};
type WithdrawReturnType = SendTransactionReturnType;
declare function withdraw<chain extends Chain | undefined, account extends Account | undefined, chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>>(client: Client<Transport, chain, account>, parameters: WithdrawParameters<chain, account, chainOverride, derivedChain>): Promise<WithdrawReturnType>;

type GetBlockExtraDataReturnType = Prettify<{
    version: number;
    fixedCost: number;
    variableCost: number;
    ethGasPrice: number;
}>;
type GetBlockExtraDataParameters<blockTag extends BlockTag = "latest"> = Omit<GetBlockParameters<false, blockTag>, "includeTransactions">;
declare function getBlockExtraData<chain extends Chain | undefined, account extends Account | undefined, blockTag extends BlockTag = "latest">(client: Client<Transport, chain, account>, parameters: GetBlockExtraDataParameters<blockTag>): Promise<GetBlockExtraDataReturnType>;

type GetL1ToL2MessageStatusReturnType = OnChainMessageStatus;
type GetL1ToL2MessageStatusParameters = {
    messageHash: Hex;
    l2MessageServiceAddress?: Address;
};
declare function getL1ToL2MessageStatus<chain extends Chain | undefined, account extends Account | undefined>(client: Client<Transport, chain, account>, parameters: GetL1ToL2MessageStatusParameters): Promise<GetL1ToL2MessageStatusReturnType>;

type GetL2ToL1MessageStatusParameters<chain extends Chain | undefined, account extends Account | undefined, abi extends Abi | readonly unknown[] = Abi, eventName extends ContractEventName<abi> | undefined = ContractEventName<abi> | undefined, strict extends boolean | undefined = undefined, fromBlock extends BlockNumber | BlockTag | undefined = undefined, toBlock extends BlockNumber | BlockTag | undefined = undefined> = {
    l2Client: Client<Transport, chain, account>;
    messageHash: Hex;
    l2LogsBlockRange?: Pick<GetContractEventsParameters<abi, eventName, strict, fromBlock, toBlock>, "fromBlock" | "toBlock">;
    lineaRollupAddress?: Address;
    l2MessageServiceAddress?: Address;
};
type GetL2ToL1MessageStatusReturnType = OnChainMessageStatus;
declare function getL2ToL1MessageStatus<chain extends Chain | undefined, account extends Account | undefined, chainL2 extends Chain | undefined, accountL2 extends Account | undefined>(client: Client<Transport, chain, account>, parameters: GetL2ToL1MessageStatusParameters<chainL2, accountL2>): Promise<GetL2ToL1MessageStatusReturnType>;

type GetMessageByMessageHashParameters = {
    messageHash: Hex;
    messageServiceAddress?: Address;
};
type GetMessageByMessageHashReturnType = {
    from: Hex;
    to: Hex;
    fee: bigint;
    value: bigint;
    nonce: bigint;
    calldata: Hex;
    messageHash: Hex;
    transactionHash: Hex;
    blockNumber: bigint;
};
declare function getMessageByMessageHash<chain extends Chain | undefined, account extends Account | undefined>(client: Client<Transport, chain, account>, parameters: GetMessageByMessageHashParameters): Promise<GetMessageByMessageHashReturnType>;

type GetMessageProofReturnType = MessageProof;
type GetMessageProofParameters<chain extends Chain | undefined, account extends Account | undefined, abi extends Abi | readonly unknown[] = Abi, eventName extends ContractEventName<abi> | undefined = ContractEventName<abi> | undefined, strict extends boolean | undefined = undefined, fromBlock extends BlockNumber | BlockTag | undefined = undefined, toBlock extends BlockNumber | BlockTag | undefined = undefined> = {
    l2Client: Client<Transport, chain, account>;
    messageHash: Hex;
    l2LogsBlockRange?: Pick<GetContractEventsParameters<abi, eventName, strict, fromBlock, toBlock>, "fromBlock" | "toBlock">;
    lineaRollupAddress?: Address;
    l2MessageServiceAddress?: Address;
};
declare function getMessageProof<chain extends Chain | undefined, account extends Account | undefined, chainL2 extends Chain | undefined, accountL2 extends Account | undefined>(client: Client<Transport, chain, account>, parameters: GetMessageProofParameters<chainL2, accountL2>): Promise<GetMessageProofReturnType>;

type EventLogBase = {
    blockNumber: number;
    logIndex: number;
    contractAddress: string;
    transactionHash: string;
};
type MessageSent = {
    messageSender: Address;
    destination: Address;
    fee: bigint;
    value: bigint;
    messageNonce: bigint;
    calldata: Hex;
    messageHash: Hash;
} & EventLogBase;
type GetMessageSentEventsReturnType = MessageSent[];
type GetMessageSentEventsParameters<abi extends Abi | readonly unknown[] = Abi, eventName extends ContractEventName<abi> | undefined = ContractEventName<abi> | undefined, strict extends boolean | undefined = undefined, fromBlock extends BlockNumber | BlockTag | undefined = undefined, toBlock extends BlockNumber | BlockTag | undefined = undefined> = Pick<GetContractEventsParameters<abi, eventName, strict, fromBlock, toBlock>, "args" | "fromBlock" | "toBlock" | "address">;
declare function getMessageSentEvents<chain extends Chain | undefined, account extends Account | undefined, strict extends boolean | undefined = undefined, fromBlock extends BlockNumber | BlockTag | undefined = undefined, toBlock extends BlockNumber | BlockTag | undefined = undefined>(client: Client<Transport, chain, account>, parameters: GetMessageSentEventsParameters<[
    {
        anonymous: false;
        inputs: [
            {
                indexed: true;
                internalType: "address";
                name: "_from";
                type: "address";
            },
            {
                indexed: true;
                internalType: "address";
                name: "_to";
                type: "address";
            },
            {
                indexed: false;
                internalType: "uint256";
                name: "_fee";
                type: "uint256";
            },
            {
                indexed: false;
                internalType: "uint256";
                name: "_value";
                type: "uint256";
            },
            {
                indexed: false;
                internalType: "uint256";
                name: "_nonce";
                type: "uint256";
            },
            {
                indexed: false;
                internalType: "bytes";
                name: "_calldata";
                type: "bytes";
            },
            {
                indexed: true;
                internalType: "bytes32";
                name: "_messageHash";
                type: "bytes32";
            }
        ];
        name: "MessageSent";
        type: "event";
    }
], "MessageSent", strict, fromBlock, toBlock>): Promise<{
    messageSender: `0x${string}`;
    destination: `0x${string}`;
    fee: bigint;
    value: bigint;
    messageNonce: bigint;
    calldata: `0x${string}`;
    messageHash: `0x${string}`;
    blockNumber: ((NonNullable<fromBlock> extends infer T ? T extends NonNullable<fromBlock> ? T extends "pending" ? true : false : never : never) extends infer T_1 ? T_1 extends (NonNullable<fromBlock> extends infer T_2 ? T_2 extends NonNullable<fromBlock> ? T_2 extends "pending" ? true : false : never : never) ? T_1 extends true ? null : bigint : never : never) | ((NonNullable<toBlock> extends infer T_3 ? T_3 extends NonNullable<toBlock> ? T_3 extends "pending" ? true : false : never : never) extends infer T_4 ? T_4 extends (NonNullable<toBlock> extends infer T_5 ? T_5 extends NonNullable<toBlock> ? T_5 extends "pending" ? true : false : never : never) ? T_4 extends true ? null : bigint : never : never);
    logIndex: ((NonNullable<fromBlock> extends infer T_6 ? T_6 extends NonNullable<fromBlock> ? T_6 extends "pending" ? true : false : never : never) extends infer T_7 ? T_7 extends (NonNullable<fromBlock> extends infer T_8 ? T_8 extends NonNullable<fromBlock> ? T_8 extends "pending" ? true : false : never : never) ? T_7 extends true ? null : number : never : never) | ((NonNullable<toBlock> extends infer T_9 ? T_9 extends NonNullable<toBlock> ? T_9 extends "pending" ? true : false : never : never) extends infer T_10 ? T_10 extends (NonNullable<toBlock> extends infer T_11 ? T_11 extends NonNullable<toBlock> ? T_11 extends "pending" ? true : false : never : never) ? T_10 extends true ? null : number : never : never);
    contractAddress: `0x${string}`;
    transactionHash: ((NonNullable<fromBlock> extends infer T_12 ? T_12 extends NonNullable<fromBlock> ? T_12 extends "pending" ? true : false : never : never) extends infer T_13 ? T_13 extends (NonNullable<fromBlock> extends infer T_14 ? T_14 extends NonNullable<fromBlock> ? T_14 extends "pending" ? true : false : never : never) ? T_13 extends true ? null : `0x${string}` : never : never) | ((NonNullable<toBlock> extends infer T_15 ? T_15 extends NonNullable<toBlock> ? T_15 extends "pending" ? true : false : never : never) extends infer T_16 ? T_16 extends (NonNullable<toBlock> extends infer T_17 ? T_17 extends NonNullable<toBlock> ? T_17 extends "pending" ? true : false : never : never) ? T_16 extends true ? null : `0x${string}` : never : never);
}[]>;

type GetMessagesByTransactionHashParameters = {
    transactionHash: Hex;
    messageServiceAddress?: Address;
};
type GetMessagesByTransactionHashReturnType = ExtendedMessage[];
declare function getMessagesByTransactionHash<chain extends Chain | undefined, account extends Account | undefined>(client: Client<Transport, chain, account>, parameters: GetMessagesByTransactionHashParameters): Promise<GetMessagesByTransactionHashReturnType>;

type GetTransactionReceiptByMessageHashParameters = {
    messageHash: Hex;
    messageServiceAddress?: Address;
};
type GetTransactionReceiptByMessageHashReturnType<chain extends Chain | undefined> = GetTransactionReceiptReturnType<chain>;
declare function getTransactionReceiptByMessageHash<chain extends Chain | undefined, account extends Account | undefined>(client: Client<Transport, chain, account>, parameters: GetTransactionReceiptByMessageHashParameters): Promise<GetTransactionReceiptByMessageHashReturnType<chain>>;

type ClaimOnL1Parameters<chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined, chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>> = Omit<FormattedTransactionRequest<derivedChain>, "data" | "to" | "from"> & Partial<GetChainParameter<chain, chainOverride>> & Partial<GetAccountParameter<account>> & Omit<Message<bigint>, "messageHash" | "nonce"> & {
    messageNonce: bigint;
    messageProof: MessageProof;
    feeRecipient?: Address;
    lineaRollupAddress?: Address;
};
type ClaimOnL1ReturnType = SendTransactionReturnType;
declare function claimOnL1<chain extends Chain | undefined, account extends Account | undefined, chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>>(client: Client<Transport, chain, account>, parameters: ClaimOnL1Parameters<chain, account, chainOverride, derivedChain>): Promise<ClaimOnL1ReturnType>;

type ClaimOnL2Parameters<chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined, chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>> = Omit<FormattedTransactionRequest<derivedChain>, "data" | "to" | "from"> & Partial<GetChainParameter<chain, chainOverride>> & Partial<GetAccountParameter<account>> & Omit<Message, "messageHash" | "nonce"> & {
    messageNonce: bigint;
    feeRecipient?: Address;
    l2MessageServiceAddress?: Address;
};
type ClaimOnL2ReturnType = SendTransactionReturnType;
declare function claimOnL2<chain extends Chain | undefined, account extends Account | undefined, chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>>(client: Client<Transport, chain, account>, parameters: ClaimOnL2Parameters<chain, account, chainOverride, derivedChain>): Promise<ClaimOnL2ReturnType>;

type FunctionKeys<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];
type StrictFunctionOnly<T, U> = [keyof U] extends [FunctionKeys<T>] ? [FunctionKeys<T>] extends [keyof U] ? U : never : never;

type PublicActionsL1<chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined> = StrictFunctionOnly<L1PublicClient, {
    getMessageProof: <abi extends Abi | readonly unknown[] = Abi, eventName extends ContractEventName<abi> | undefined = ContractEventName<abi> | undefined, strict extends boolean | undefined = undefined, fromBlock extends BlockNumber | BlockTag | undefined = undefined, toBlock extends BlockNumber | BlockTag | undefined = undefined>(args: GetMessageProofParameters<chain, account, abi, eventName, strict, fromBlock, toBlock>) => Promise<GetMessageProofReturnType>;
    getL2ToL1MessageStatus: <abi extends Abi | readonly unknown[] = Abi, eventName extends ContractEventName<abi> | undefined = ContractEventName<abi> | undefined, strict extends boolean | undefined = undefined, fromBlock extends BlockNumber | BlockTag | undefined = undefined, toBlock extends BlockNumber | BlockTag | undefined = undefined>(args: GetL2ToL1MessageStatusParameters<chain, account, abi, eventName, strict, fromBlock, toBlock>) => Promise<GetL2ToL1MessageStatusReturnType>;
    getMessageByMessageHash: (args: GetMessageByMessageHashParameters) => Promise<GetMessageByMessageHashReturnType>;
    getMessagesByTransactionHash: (args: GetMessagesByTransactionHashParameters) => Promise<GetMessagesByTransactionHashReturnType>;
    getTransactionReceiptByMessageHash: <chain extends Chain | undefined>(args: GetTransactionReceiptByMessageHashParameters) => Promise<GetTransactionReceiptByMessageHashReturnType<chain>>;
}>;
type PublicActionsL1Parameters = {
    lineaRollupAddress: Address;
    l2MessageServiceAddress: Address;
};
declare function publicActionsL1(parameters?: PublicActionsL1Parameters): <chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined>(client: Client<Transport, chain, account>) => PublicActionsL1<chain, account>;

type PublicActionsL2<chain extends Chain | undefined = Chain | undefined> = StrictFunctionOnly<L2PublicClient, {
    getBlockExtraData: <blockTag extends BlockTag = "latest">(args: GetBlockExtraDataParameters<blockTag>) => Promise<GetBlockExtraDataReturnType>;
    getL1ToL2MessageStatus: (args: GetL1ToL2MessageStatusParameters) => Promise<GetL1ToL2MessageStatusReturnType>;
    getMessageByMessageHash: (args: GetMessageByMessageHashParameters) => Promise<GetMessageByMessageHashReturnType>;
    getMessagesByTransactionHash: (args: GetMessagesByTransactionHashParameters) => Promise<GetMessagesByTransactionHashReturnType>;
    getTransactionReceiptByMessageHash: (args: GetTransactionReceiptByMessageHashParameters) => Promise<GetTransactionReceiptByMessageHashReturnType<chain>>;
}>;
type PublicActionsL2Parameters = {
    l2MessageServiceAddress: Address;
};
declare function publicActionsL2(parameters?: PublicActionsL2Parameters): <transport extends Transport = Transport, chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined>(client: Client<transport, chain, account>) => PublicActionsL2<chain>;

type WalletActionsL1<chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined> = StrictFunctionOnly<L1WalletClient, {
    deposit: <chainOverride extends Chain | undefined = Chain | undefined, chainL2 extends Chain | undefined = Chain | undefined, accountL2 extends Account | undefined = Account | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>>(args: DepositParameters<chain, account, chainOverride, chainL2, accountL2, derivedChain>) => Promise<DepositReturnType>;
    claimOnL1: <chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>>(args: ClaimOnL1Parameters<chain, account, chainOverride, derivedChain>) => Promise<ClaimOnL1ReturnType>;
}>;
type WalletActionsL1Parameters = {
    lineaRollupAddress: Address;
    l2MessageServiceAddress: Address;
    l1TokenBridgeAddress: Address;
    l2TokenBridgeAddress: Address;
};
declare function walletActionsL1(parameters?: WalletActionsL1Parameters): <TChain extends Chain | undefined = Chain | undefined, TAccount extends Account | undefined = Account | undefined>(client: Client<Transport, TChain, TAccount>) => WalletActionsL1;

type WalletActionsL2<chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined> = StrictFunctionOnly<L2WalletClient, {
    withdraw: <chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>>(args: WithdrawParameters<chain, account, chainOverride, derivedChain>) => Promise<WithdrawReturnType>;
    claimOnL2: <chainOverride extends Chain | undefined = Chain | undefined, derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>>(args: ClaimOnL2Parameters<chain, account, chainOverride, derivedChain>) => Promise<ClaimOnL2ReturnType>;
}>;
type WalletActionsL2Parameters = {
    l2MessageServiceAddress: Address;
    l2TokenBridgeAddress: Address;
};
declare function walletActionsL2(parameters?: WalletActionsL2Parameters): <TChain extends Chain | undefined = Chain | undefined, TAccount extends Account | undefined = Account | undefined>(client: Client<Transport, TChain, TAccount>) => WalletActionsL2;

export { type ClaimOnL1Parameters, type ClaimOnL1ReturnType, type ClaimOnL2Parameters, type ClaimOnL2ReturnType, type DepositParameters, type DepositReturnType, type GetBlockExtraDataParameters, type GetBlockExtraDataReturnType, type GetL1ToL2MessageStatusParameters, type GetL1ToL2MessageStatusReturnType, type GetL2ToL1MessageStatusParameters, type GetL2ToL1MessageStatusReturnType, type GetMessageByMessageHashParameters, type GetMessageByMessageHashReturnType, type GetMessageProofParameters, type GetMessageProofReturnType, type GetMessageSentEventsParameters, type GetMessageSentEventsReturnType, type GetMessagesByTransactionHashParameters, type GetMessagesByTransactionHashReturnType, type GetTransactionReceiptByMessageHashParameters, type GetTransactionReceiptByMessageHashReturnType, type PublicActionsL1, type PublicActionsL2, type WalletActionsL1, type WalletActionsL2, type WithdrawParameters, type WithdrawReturnType, claimOnL1, claimOnL2, deposit, getBlockExtraData, getL1ToL2MessageStatus, getL2ToL1MessageStatus, getMessageByMessageHash, getMessageProof, getMessageSentEvents, getMessagesByTransactionHash, getTransactionReceiptByMessageHash, publicActionsL1, publicActionsL2, walletActionsL1, walletActionsL2, withdraw };
