
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';


import { Request, Response } from 'express';
import { ApiRestService } from 'src/engine/api/rest/api-rest.service';
import { id } from 'date-fns/locale';

import { queryFindOneCompany } from './queries/find-one-company.query';
import { updateOneOpportunity } from './queries/update-one-opportunity.query';

  

@Controller('cats')
export class CatsController {
  constructor(
  ) {}

  @Get()
  async create(@Req() request: Request): Promise<string> {
      console.log("These are the request body", request.body);
      // console.log("These are the request headers", req.headers);
      return "These are the cats respones";
    }
}



@UseGuards(JwtAuthGuard)
@Controller('dogs')
export class DogsController {
  constructor(
    private readonly apiRestService: ApiRestService,
  ) {}
  @Get()
  async findAll(@Req() request: Request): Promise<object> {

    // const varP = {
    //   "objectRecordId": "20202020-707e-44dc-a1d2-30030bf1a944"
    // }

    // const varUpdate = {
    //   "idToUpdate": "20202020-35b1-4045-9cde-42f715148954",
    //   "input": {
    //     "stage": "PROPOSAL",
    //     "position": 0.5
    //   }
    // }

  
    // const result = await this.apiRestService.callGraphql(request, {query: updateOneOpportunity, variables: varUpdate});
    // const resultObj = result.data
    const timenow = 'This action returns all dogs at time ::' + new Date().toLocaleString();
    console.log("This is the timenow  ", timenow);

    return {};
  }
}
