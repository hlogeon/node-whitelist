import config from '../config';
import { Response, Request } from 'express';
import {controller, httpGet, httpPost} from 'inversify-express-utils';
import 'reflect-metadata';
import { AuthorizedRequest } from '../requests/authorized.request';
import { Web3ClientInterface, Web3ClientType } from '../services/web3.client';
import { Logger } from '../logger';
import { inject } from "inversify";

@controller(
  '/secret'
  // 'OnlyAcceptApplicationJson'
)
export class SecretController {
  private logger = Logger.getInstance('SECRET_CONTROLLER');

  @inject(Web3ClientType) private web3Client: Web3ClientInterface;

  @httpPost(
      '/whitelist'
  )
  async addToWhitelist(req: Request, res: Response) {
    if (req.body.password !== config.app.password) {
      throw new Error('Unauthenticated');
    }
    if(!this.web3Client.isHex(req.body.address)) {
      throw new Error('Address needs to be a valid hex string');
    }
    const txHash = await this.web3Client.addAddressToWhiteList(req.body.address);
    res.json({
      status: "ok",
      transaction: txHash
    });
  }

  @httpGet(
      '/whitelist'
  )
  async isWhitelisted(req: Request, res: Response) {
    if (!req.query.address || !this.web3Client.isHex(req.query.address)) {
      throw new Error('Address number must be valid hex string');
    }
    const response = await this.web3Client.isAllowed(req.query.address);
    res.json({
      status: response
    });
  }

  @httpPost(
    '/referral'
  )
  async addReferral(req: Request, res: Response) {
    if (req.body.password !== config.app.password) {
      throw new Error('Unauthenticated');
    }
    if(!this.web3Client.isHex(req.body.address) || !this.web3Client.isHex(req.body.referral)) {
      throw new Error('Address and referral need to be a valid hex string');
    }
    const txHash = await this.web3Client.addReferralOf(req.body.address, req.body.referral);
    res.json({
      status: "ok",
      transaction: txHash
    });
  }

  @httpGet(
    '/referral'
  )
  async getReferralOf(req: Request, res: Response) {
    if (!req.query.address || !this.web3Client.isHex(req.query.address)) {
      throw new Error('Address number must be valid hex string');
    }
    const response = await this.web3Client.getReferralOf(req.query.address);
    res.json({
      referral: response
    });
  }

  @httpGet(
    '/info'
  )
  async info(req: Request, res: Response): Promise<void> {
    if(!req.query.transaction || !this.web3Client.isHex(req.query.transaction)) {
      throw new Error('Transaction number must be valid hex string');
    }
    const status = await this.web3Client.getTxStatus(req.query.transaction);
    res.json(status);
  }

}
