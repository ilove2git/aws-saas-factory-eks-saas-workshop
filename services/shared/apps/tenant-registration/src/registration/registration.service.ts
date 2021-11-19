/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import {
  CodePipelineClient,
  StartPipelineExecutionCommand,
} from '@aws-sdk/client-codepipeline';

import { CreateRegistrationDto } from './dto/create-registration.dto';
import { IdpService } from '../idp-service/idp.service';
import { Registration } from './entities/registration.entity';
import { UsersService } from '../users/users.service';
import { ClientFactoryService } from 'libs/client-factory/src';
import { PLAN_TYPE } from '../models/types';
import { getTimeString } from '../utils/utils';

@Injectable()
export class RegistrationService {
  tableName: string = process.env.TENANT_TABLE_NAME;

  constructor(
    private clientFac: ClientFactoryService,
    private idpSvc: IdpService,
    private userSvc: UsersService,
  ) {}

  async create(dto: CreateRegistrationDto) {
    try {
      console.log('Creating tenant:', dto);
      const tenant = await this.store(dto);
      this.register(tenant);
      this.provision(dto.plan);
    } catch (error) {
      console.error(error);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async store(dto: CreateRegistrationDto) {
    const tenantId = uuid();
    const newTenant = new Registration(
      tenantId,
      dto.email,
      dto.plan,
      dto.companyName,
    );
    const client = this.clientFac.client;
    const item = {
      tenant_id: newTenant.tenantId,
      email: newTenant.email,
      plan: newTenant.plan.toString(),
      companyName: newTenant.companyName,
    };
    const cmd = new PutCommand({
      Item: item,
      TableName: this.tableName,
    });
    const res = await client.send(cmd);
    console.log('Successfully stored tenant', res.Attributes);
    return newTenant;
  }

  private async register(registration: Registration) {
    console.log('Registering tenant:', registration);
    const userPoolId = await this.idpSvc.getUserPool(
      registration.tenantId,
      registration.Path,
      registration.plan,
    );
    console.log(userPoolId);
    await this.userSvc.addFirstUser(
      userPoolId.toString(),
      registration.email,
      registration.tenantId,
      registration.companyName,
    );
  }

  private async provision(plan: PLAN_TYPE) {
    if (plan !== PLAN_TYPE.Premium) {
      return;
    }
    console.log('Provisioning tenant:');
    // TODO - Add this to the ClientFactory!?!
    const client = new CodePipelineClient({ region: process.env.AWS_REGION });

    const params = {
      name: 'eks-saas-tenant-onboarding-pipeline',
      clientRequestToken: 'requestToken-' + getTimeString(),
    };

    const command = new StartPipelineExecutionCommand(params);
    const response = await client.send(command);
    console.log('Successfully started pipeline!');
  }
}
