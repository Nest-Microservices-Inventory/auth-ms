import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt'
import { LoginUserDto } from './dto/login-user.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';
import { envs } from 'src/config/envs';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) { }

    async register(registerUserDto: RegisterUserDto) {

        const userExists = await this.prisma.user.findUnique({
            where: {
                email: registerUserDto.email
            }
        })

        if (userExists) {
            throw new RpcException({
                message: "Este corrego ya se encuentra registrado",
                statusCode: HttpStatus.BAD_REQUEST
            })
        }

        const user = await this.prisma.user.create({
            data: {
                ...registerUserDto,
                password: bcrypt.hashSync(registerUserDto.password, 10)
            }
        })
        const { password, ...restUser } = user
        return {
            restUser,
            message: "Usuario registrado con exito"
        }
    }

    async login(loginUserDto: LoginUserDto) {
        const { email, password } = loginUserDto

        try {
            const user = await this.prisma.user.findUnique({
                where: { email }
            })

            if (!user) {
                throw new RpcException({
                    message: "Credenciales incorrectas",
                    statusCode: HttpStatus.UNAUTHORIZED
                })
            }

            const isPasswordValid = bcrypt.compareSync(password, user.password);

            if (!isPasswordValid) {
                throw new RpcException({
                    message: "Credenciales incorrectas",
                    statusCode: HttpStatus.UNAUTHORIZED
                })
            }

            const { password: _, ...restUser } = user

            return {
                user: restUser,
                token: await this.signJWT({ email: user.email, id: user.id, name: user.name })
            }
        } catch (error) {
            console.log(error)
            throw new RpcException(error.error)
        }
    }

    async signJWT(payload: JwtPayload) {
        return this.jwtService.sign(payload);
    }

    async verify(token: string) {
        try {

            const { sub, iat, exp, ...user } = this.jwtService.verify(token, { secret: envs.jwtSecret })

            return {
                user,
                token
            }

        } catch (error) {
            throw new RpcException({
                statusCode: HttpStatus.UNAUTHORIZED,
                message: "Token invalido"
            })
        }
    }
}
