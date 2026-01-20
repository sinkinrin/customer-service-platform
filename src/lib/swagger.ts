import { createSwaggerSpec } from 'next-swagger-doc'

export const getApiDocs = async () => {
    const spec = createSwaggerSpec({
        // apiFolder: 'src/app/api', // directory scan causes EISDIR
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'Customer Service Platform API',
                version: '1.0.0',
                description: 'API documentation for the Customer Service Platform',
            },
            security: [
                {
                    BearerAuth: [],
                },
            ],
            components: {
                securitySchemes: {
                    BearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
        },
        apis: ['./src/app/api/**/route.ts'], // Target route files explicitly
    })
    return spec
}
