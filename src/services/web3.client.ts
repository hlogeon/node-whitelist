/**
 * Created by hlogeon on 11/06/2018.
 */
import { injectable } from 'inversify';

const Web3 = require('web3');
const net = require('net');

const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');
import config from '../config';
import 'reflect-metadata';
import { Logger } from '../logger';

export interface Web3ClientInterface {
    sendTransactionByMnemonic(input: TransactionInput, mnemonic: string, salt: string): Promise<string>;

    sendTransactionByPrivateKey(input: TransactionInput, privateKey: string): Promise<string>;

    generateMnemonic(): string;

    getAccountByMnemonicAndSalt(mnemonic: string, salt: string): any;

    addAddressToWhiteList(address: string): any;

    addReferralOf(address: string, referral: string): any;

    isAllowed(account: string): Promise<boolean>;

    getReferralOf(account: string): Promise<string>;

    getEthBalance(address: string): Promise<string>;

    sufficientBalance(input: TransactionInput): Promise<boolean>;

    getCurrentGasPrice(): Promise<string>;

    investmentFee(): Promise<any>;

    isHex(key: any): boolean;

    getTxStatus(transaction: string): any;
}

/* istanbul ignore next */
@injectable()
export class Web3Client implements Web3ClientInterface {
    private logger = Logger.getInstance('WEB3CLIENT');

    whiteList: any;
    web3: any;

    constructor() {
        switch (config.rpc.type) {
            case 'ipc':
                this.web3 = new Web3(new Web3.providers.IpcProvider(config.rpc.address, net));
                break;
            case 'ws':
                const webSocketProvider = new Web3.providers.WebsocketProvider(config.rpc.address);

                webSocketProvider.connection.onclose = () => {
                    this.logger.info('Web3 socket connection closed');
                    this.onWsClose();
                };

                this.web3 = new Web3(webSocketProvider);
                break;
            case 'http':
                this.web3 = new Web3(config.rpc.address);
                break;
            default:
                throw Error('Unknown Web3 RPC type!');
        }
        this.whiteList = new this.web3.eth.Contract(config.contracts.whiteList.abi, config.contracts.whiteList.address);
    }

    sendTransactionByMnemonic(input: TransactionInput, mnemonic: string, salt: string): Promise<string> {
        const privateKey = this.getPrivateKeyByMnemonicAndSalt(mnemonic, salt);
        const params = {
            value: this.web3.utils.toWei(input.amount.toString()),
            from: input.from,
            to: input.to,
            gas: input.gas,
            gasPrice: this.web3.utils.toWei(input.gasPrice, 'gwei')
        };

        return new Promise<string>((resolve, reject) => {
            this.sufficientBalance(input).then((sufficient) => {
                if (!sufficient) {
                    reject({
                        message: 'Insufficient funds to perform this operation and pay tx fee'
                    });
                }

                this.web3.eth.accounts.signTransaction(params, privateKey).then(transaction => {
                    this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
                        .on('transactionHash', transactionHash => {
                            resolve(transactionHash);
                        })
                        .on('error', (error) => {
                            reject(error);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                });
            });
        });
    }

    sendTransactionByPrivateKey(input: TransactionInput, privateKey: string): Promise<string> {
        const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);

        const params = {
            value: this.web3.utils.toWei(input.amount.toString()),
            from: account.address,
            to: input.to,
            gas: input.gas,
            gasPrice: this.web3.utils.toWei(input.gasPrice, 'gwei')
        };

        return new Promise<string>((resolve, reject) => {
            account.signTransaction(params).then(transaction => {
                this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
                    .on('transactionHash', transactionHash => {
                        resolve(transactionHash);
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        });
    }

    generateMnemonic(): string {
        return bip39.generateMnemonic();
    }

    getAccountByMnemonicAndSalt(mnemonic: string, salt: string): any {
        const privateKey = this.getPrivateKeyByMnemonicAndSalt(mnemonic, salt);
        return this.web3.eth.accounts.privateKeyToAccount(privateKey);
    }

    getPrivateKeyByMnemonicAndSalt(mnemonic: string, salt: string) {
        // get seed
        const hdWallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic, salt));

        // get first of available wallets
        const path = 'm/44\'/60\'/0\'/0/0';

        // get wallet
        const wallet = hdWallet.derivePath(path).getWallet();

        // get private key
        return '0x' + wallet.getPrivateKey().toString('hex');
    }

    addAddressToWhiteList(address: string) {
        return new Promise(async(resolve, reject) => {
            const account = this.web3.eth.accounts.privateKeyToAccount(config.contracts.whiteList.ownerPk);
            const params = {
                value: '0',
                to: this.whiteList.options.address,
                gas: 200000,
                nonce: await this.web3.eth.getTransactionCount(account.address, 'pending'),
                data: this.whiteList.methods.addInvestorToWhiteList(address).encodeABI()
            };

            account.signTransaction(params).then(transaction => {
                this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
                    .on('transactionHash', transactionHash => {
                        resolve(transactionHash);
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        });
    }

    addReferralOf(address: string, referral: string) {
        return new Promise((resolve, reject) => {
            const params = {
                value: '0',
                to: this.whiteList.options.address,
                gas: 200000,
                data: this.whiteList.methods.addReferralOf(address, referral).encodeABI()
            };

            this.web3.eth.accounts.signTransaction(params, config.contracts.whiteList.ownerPk).then(transaction => {
                this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
                    .on('transactionHash', transactionHash => {
                        resolve(transactionHash);
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        });
    }

    async isAllowed(address: string): Promise<boolean> {
        return await this.whiteList.methods.isAllowed(address).call();
    }

    async getReferralOf(address: string): Promise<string> {
        return await this.whiteList.methods.getReferralOf(address).call();
    }

    async getEthBalance(address: string): Promise<string> {
        return this.web3.utils.fromWei(
            await this.web3.eth.getBalance(address)
        );
    }


    sufficientBalance(input: TransactionInput): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.web3.eth.getBalance(input.from)
                .then((balance) => {
                    const BN = this.web3.utils.BN;
                    const txFee = new BN(input.gas).mul(new BN(this.web3.utils.toWei(input.gasPrice, 'gwei')));
                    const total = new BN(this.web3.utils.toWei(input.amount)).add(txFee);
                    resolve(total.lte(new BN(balance)));
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    onWsClose() {
        this.logger.error('Web3 socket connection closed. Trying to reconnect');
        const webSocketProvider = new Web3.providers.WebsocketProvider(config.rpc.address);
        webSocketProvider.connection.onclose = () => {
            this.logger.info('Web3 socket connection closed');
            setTimeout(() => {
                this.onWsClose();
            }, config.rpc.reconnectTimeout);
        };

        this.web3.setProvider(webSocketProvider);
        this.whiteList = new this.web3.eth.Contract(config.contracts.whiteList.abi, config.contracts.whiteList.address);
    }

    async getCurrentGasPrice(): Promise<string> {
        return this.web3.utils.fromWei(await this.web3.eth.getGasPrice(), 'gwei');
    }

    async investmentFee(): Promise<any> {
        const gasPrice = await this.getCurrentGasPrice();
        const gas = 200000;
        const BN = this.web3.utils.BN;

        return {
            gasPrice,
            gas,
            expectedTxFee: this.web3.utils.fromWei(
                new BN(gas).mul(new BN(this.web3.utils.toWei(gasPrice, 'gwei'))).toString()
            )
        };
    }

    isHex(key: any): boolean {
        return this.web3.utils.isHex(key);
    }

    getTxStatus(transaction: string) {
        return this.web3.eth.getTransactionReceipt(transaction);
    }
}

const Web3ClientType = Symbol('Web3ClientInterface');
export {Web3ClientType};