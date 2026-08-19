import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { buildPostsApiOpenApiDocument } from '../api-docs/posts-api.openapi';
import { PostSearchDto } from './dto/post-search.dto';
import { PostsApiService } from './posts-api.service';

const POSTS_API_BODY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@Controller('posts-api')
export class PostsApiController {
  private readonly logger = new Logger(PostsApiController.name);

  constructor(private readonly postsApiService: PostsApiService) {}

  @Get('openapi.json')
  getOpenApiSchema(@Req() request: Request, @Res() res: Response) {
    const serverUrl = `${request.protocol}://${request.get('host')}`;
    const document = buildPostsApiOpenApiDocument(serverUrl);

    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  }

  @Get('data-sources')
  @UseGuards(JwtAuthGuard)
  getDataSources() {
    return this.postsApiService.getDataSourcesStatus();
  }

  @Post('posts/search')
  @UseGuards(JwtAuthGuard)
  async searchPosts(
    @Req() request: Request,
    @Body(POSTS_API_BODY_VALIDATION_PIPE) body: PostSearchDto,
  ) {
    try {
      return await this.postsApiService.searchPosts(
        body,
        this.getAuthToken(request) ?? undefined,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Posts API search failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Post search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getAuthToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim() || null;
    }
    return null;
  }
}
