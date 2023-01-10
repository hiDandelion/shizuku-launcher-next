import clientPromise from "../../../lib/mongodb";
import { verifyRegistrationResponse } from '@simplewebauthn/server';

const domain = "shizuku-launcher-next-git-dev-hidandelion.vercel.app";
const origin = ["http://localhost:3000", "https://shizuku-launcher-next-git-dev-hidandelion.vercel.app"];

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db("shizuku_launcher_development");

        const user = await db
            .collection("users")
            .findOne({
                username: req.body.username
            });

        const { verified, registrationInfo: info } = await verifyRegistrationResponse(
            {
                response: req.body.credential,
                expectedChallenge: user.challenge,
                expectedOrigin: origin,
                expectedRPID: domain
            });
        if (!verified || !info) {
            throw new Error("Register Autentication Failed");
        }

        db
            .collection("users")
            .updateOne({
                username: req.body.username
            }, {
                $set: {
                    authenticator: {
                        credentialID: req.body.credential.id,
                        transports: req.body.credential.transports ?? ['internal'],
                        userID: req.body.username,
                        credentialPublicKey: info.credentialPublicKey,
                        counter: info.counter
                    }
                }
            });

        return res.status(200).send({
            username: req.body.username
        });
    } catch (err) {
        return res.status(500).send({
            error: {
                message: err.message
            }
        });
    }
}
