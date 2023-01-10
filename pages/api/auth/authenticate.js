import clientPromise from "../../../lib/mongodb";
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import base64url from 'base64url';

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

        const { verified, authenticationInfo: info } = await verifyAuthenticationResponse(
            {
                response: req.body.credential,
                expectedChallenge: user.challenge,
                expectedOrigin: origin,
                expectedRPID: domain,
                authenticator: {
                    credentialPublicKey: user.authenticator.credentialPublicKey.buffer,
                    credentialID: base64url.toBuffer(user.authenticator.credentialID),
                    counter: user.authenticator.counter
                }
            });
        if (!verified || !info) {
            throw new Error("Autentication Failed");
        }

        db
            .collection("users")
            .updateOne({
                username: req.body.username
            }, {
                $set: {
                    counter: info.newCounter
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
