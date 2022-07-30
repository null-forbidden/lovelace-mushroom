import { css } from "lit";

export const cardStyle = css`
    ha-card {
        box-sizing: border-box;
        padding: var(--spacing);
        display: flex;
        flex-direction: column;
        justify-content: var(--layout-align);
        height: auto;

        -webkit-tap-highlight-color: rgba(0,0,0,0);
        -webkit-tap-highlight-color: transparent;
    }
    ha-card.fill-container {
        height: 100%;
    }
    .actions {
        height: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE 10+ */
    }
    .actions::-webkit-scrollbar {
        background: transparent; /* Chrome/Safari/Webkit */
        height: 0px;
    }
    .actions *:not(:last-child) {
        margin-right: var(--spacing);
    }
    .actions[rtl] *:not(:last-child) {
        margin-right: initial;
        margin-left: var(--spacing);
    }
    .unavailable {
        --main-color: var(--warning-color);
    }
    .actionButtons {
        display: flex;
        justify-content: space-between;
        gap: 12px;
    }
    .actionButtons mushroom-button {
        flex: 1 1 0%;
    }
`;
