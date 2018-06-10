import { Container } from 'inversify';
import { interfaces, TYPE } from 'inversify-express-utils';
import { AuthClientType, AuthClient } from './services/auth.client';
import { Auth } from './middlewares/auth';
import config from './config';
import * as express from 'express';
import * as validation from './middlewares/request.validation';
import './controllers/secret.controller';
import { Web3ClientInterface, Web3ClientType, Web3Client } from './services/web3.client';


let container = new Container();

// services

container.bind<AuthClientInterface>(AuthClientType).toConstantValue(new AuthClient(config.auth.baseUrl));
const auth = new Auth(container.get<AuthClientInterface>(AuthClientType));

// middlewares
container.bind<express.RequestHandler>('AuthMiddleware').toConstantValue(
  (req: any, res: any, next: any) => auth.authenticate(req, res, next)
);
container.bind<express.RequestHandler>('OnlyAcceptApplicationJson').toConstantValue(
  (req: any, res: any, next: any) => validation.onlyAcceptApplicationJson(req, res, next)
);

container.bind<Web3ClientInterface>(Web3ClientType).to(Web3Client).inSingletonScope();


export { container };
