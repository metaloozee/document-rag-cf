import { publicProcedure, createTRPCRouter, protectedProcedure } from "../init";
import { chatRouter } from "./chat";
import { projectRouter } from "./project";
import { settingsRouter } from "./settings";

export const appRouter = createTRPCRouter({
  chat: chatRouter,
  project: projectRouter,
  sayHello: publicProcedure.query(() => ({
    greeting: "Hello, World!",
  })),
  sayHelloButProtected: protectedProcedure.query(({ ctx }) => ({
    greeting: `Welcome back, ${ctx.session.user.name}`,
  })),
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
